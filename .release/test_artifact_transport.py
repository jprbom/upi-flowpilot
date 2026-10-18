import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

BASE=Path(__file__).resolve().parent


class ArtifactTransportTests(unittest.TestCase):
    def test_directory_roundtrip_preserves_hash_input_layout_and_excludes_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);source=root/'ml/checkpoints/model';source.mkdir(parents=True)
            (source/'weights.bin').write_bytes(b'synthetic fixture')
            (source/'private.txt').write_text('excluded fixture')
            env=dict(os.environ,RELEASE_WORKFLOW_ID='ci',RELEASE_EVIDENCE_NAME='model',
                     RELEASE_EVIDENCE_PATHS='ml/checkpoints/model\n!ml/checkpoints/model/private.txt',
                     RELEASE_EVIDENCE_REQUIRED='error')
            subprocess.run([sys.executable,str(BASE/'collect-evidence.py')],cwd=root,env=env,check=True)
            env.update(RELEASE_ARTIFACT_NAME='model',RELEASE_ARTIFACT_TARGET='.container-input/artifact')
            subprocess.run([sys.executable,str(BASE/'load-artifact.py')],cwd=root,env=env,check=True)
            self.assertEqual((root/'.container-input/artifact/weights.bin').read_bytes(),b'synthetic fixture')
            self.assertFalse((root/'.container-input/artifact/private.txt').exists())

    def test_missing_required_artifact_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            env=dict(os.environ,RELEASE_WORKFLOW_ID='ci',RELEASE_EVIDENCE_NAME='model',
                     RELEASE_EVIDENCE_PATHS='missing/',RELEASE_EVIDENCE_REQUIRED='error')
            result=subprocess.run([sys.executable,str(BASE/'collect-evidence.py')],cwd=tmp,env=env,capture_output=True)
            self.assertNotEqual(result.returncode,0)

    def test_artifact_download_cannot_escape_checkout(self):
        with tempfile.TemporaryDirectory() as tmp:
            env=dict(os.environ,RELEASE_WORKFLOW_ID='ci',RELEASE_ARTIFACT_NAME='model',
                     RELEASE_ARTIFACT_TARGET='../outside')
            result=subprocess.run([sys.executable,str(BASE/'load-artifact.py')],cwd=tmp,env=env,capture_output=True)
            self.assertNotEqual(result.returncode,0)


if __name__=='__main__':unittest.main()
