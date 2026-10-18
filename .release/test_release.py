import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(file))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


release = load('release_tool', 'release.py')
qualify = load('qualify_tool', 'qualify.py')


class ReleaseTests(unittest.TestCase):
    def test_dirty_worktree_blocks_before_fetch_or_build(self):
        with patch.object(release, 'git', return_value=' M app.py') as git:
            with self.assertRaisesRegex(ValueError, 'dirty'):
                release.source_commit({'branch': 'main'}, 'HEAD', True)
            git.assert_called_once_with('status', '--porcelain')

    def test_unpushed_commit_is_not_qualified(self):
        with patch.object(release, 'git', side_effect=['', '', 'a'*40, '', RuntimeError('not ancestor')]):
            with self.assertRaisesRegex(ValueError, 'pushed'):
                release.source_commit({'branch': 'main'}, 'HEAD', False)

    def test_unmerged_source_is_not_deployed(self):
        with patch.object(release, 'git', side_effect=['', '', 'a'*40, 'a'*40+' refs/heads/feature', RuntimeError('not ancestor')]):
            with self.assertRaisesRegex(ValueError, 'ancestor'):
                release.source_commit({'branch': 'main'}, 'HEAD', True)

    def test_failed_build_never_returns_a_deployable_receipt(self):
        with tempfile.TemporaryDirectory() as tmp:
            archive = Path(tmp)/'x.zip'
            archive.write_bytes(b'test')
            config = {'project': 'x', 'region': 'ap-south-1', 'bucket': 'x'}
            with patch.object(release, 'package_source', return_value=archive), \
                 patch.object(release, 'run', return_value=b''), \
                 patch.object(release, 'aws', side_effect=[{'build': {'id': 'x:1'}},
                    {'builds': [{'buildStatus': 'FAILED'}]}]):
                with self.assertRaisesRegex(RuntimeError, 'production has not been changed'):
                    release.qualify(config, 'a'*40)

    def test_checkout_replaced_without_dropping_tests_or_services(self):
        original = {'jobs': {'tests': {'runs-on': 'ubuntu-latest',
            'services': {'db': {'image': 'postgres:16'}},
            'steps': [{'uses': 'actions/checkout@v4', 'with': {'token': '${{ secrets.GITHUB_TOKEN }}'}},
                      {'run': 'pytest --strict-markers'}]}}}
        result = qualify.translate(original)
        self.assertEqual(result['jobs']['tests']['steps'][1]['run'], 'pytest --strict-markers')
        self.assertEqual(result['jobs']['tests']['services'], original['jobs']['tests']['services'])
        self.assertIn('uses', original['jobs']['tests']['steps'][0])
        self.assertNotIn('uses', result['jobs']['tests']['steps'][0])

    def test_credentials_and_native_jobs_fail_closed(self):
        for workflow in [
            {'jobs': {}},
            {'jobs': {'x': {'runs-on': 'macos-latest', 'steps': []}}},
            {'jobs': {'x': {'runs-on': 'ubuntu-latest', 'steps': [{'run': 'echo ${{ secrets.KEY }}'}]}}},
            {'jobs': {'x': {'runs-on': 'ubuntu-latest', 'steps': [{'uses': 'actions/download-artifact@v4'}]}}},
        ]:
            with self.assertRaises(ValueError):
                qualify.translate(workflow)

    def test_pack_contains_exact_tree_without_untracked_data(self):
        import zipfile
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            def git(*args, data=None):
                return subprocess.run(['git', '-C', str(root), *args], input=data,
                                      capture_output=True, check=True).stdout
            git('init', '-q')
            (root/'app.py').write_text('print(42)\n')
            git('add', 'app.py')
            git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'test')
            sha = git('rev-parse', 'HEAD').decode().strip()
            (root/'.env').write_text('PRIVATE=do-not-upload')
            with patch.object(release, 'ROOT', root):
                def invoke(*args, cwd=None, data=None):
                    return subprocess.run(args, cwd=root, input=data, capture_output=True, check=True).stdout
                with patch.object(release, 'run', side_effect=invoke):
                    source = release.package_source(sha, root)
            with zipfile.ZipFile(source) as archive:
                self.assertNotIn('.env', archive.namelist())
                self.assertEqual(archive.read('.release/source-commit.txt').decode().strip(), sha)
                pack = archive.read('.release/source.pack')
            target = root/'restored'
            target.mkdir()
            subprocess.run(['git', 'init', '-q', str(target)], check=True)
            subprocess.run(['git', '-C', str(target), 'unpack-objects', '-q'], input=pack, check=True)
            actual = subprocess.run(['git', '-C', str(target), 'show', sha+':app.py'], capture_output=True, check=True).stdout
            self.assertEqual(actual, b'print(42)\n')


if __name__ == '__main__':
    unittest.main()
