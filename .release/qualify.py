#!/usr/bin/env python3
"""Run archived Linux qualification jobs on CodeBuild, never production workflows."""
import copy
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import yaml

ROOT = Path.cwd()


def translate(workflow, workflow_id='checks'):
    """Keep tests/services/matrices/conditions; replace only GitHub transport."""
    result = copy.deepcopy(workflow)
    if not result.get('jobs'):
        raise ValueError('No jobs defined; refusing an empty qualification')
    result.pop(True, None)  # PyYAML's YAML 1.1 treats an unquoted `on` as boolean.
    result['on'] = {'workflow_dispatch': {}}
    result.pop('concurrency', None)
    for job_id, job in result.get('jobs', {}).items():
        if not job.get('steps'):
            raise ValueError('Reusable or empty job needs an explicit adapter: ' + job_id)
        runner = str(job.get('runs-on', ''))
        if 'macos' in runner or 'windows' in runner:
            raise ValueError('Native job needs its platform-specific release runner')
        for step in job.get('steps', []):
            action = step.get('uses', '').split('@')[0]
            if action == 'actions/checkout':
                step.pop('uses')
                step.pop('with', None)
                step['run'] = 'test "$(git rev-parse HEAD)" = "$RELEASE_COMMIT" && git diff --quiet HEAD --'
            elif action in ('actions/upload-artifact', 'actions/cache',
                            'actions/download-artifact'):
                if action == 'actions/download-artifact':
                    inputs=step.get('with',{})
                    if not inputs.get('name'):
                        raise ValueError('Artifact download requires an explicit name')
                    step.pop('uses')
                    step.pop('with',None)
                    step.setdefault('env',{}).update({
                        'RELEASE_WORKFLOW_ID':workflow_id,
                        'RELEASE_ARTIFACT_NAME':str(inputs['name']),
                        'RELEASE_ARTIFACT_TARGET':str(inputs.get('path','.'))})
                    step['run']='cd "$GITHUB_WORKSPACE" && python3 .release/load-artifact.py'
                    continue
                inputs = step.pop('with', {})
                step.pop('uses')
                if action == 'actions/upload-artifact':
                    step.setdefault('env', {}).update({
                        'RELEASE_WORKFLOW_ID': workflow_id,
                        'RELEASE_EVIDENCE_NAME': str(inputs.get('name', 'artifact')),
                        'RELEASE_EVIDENCE_PATHS': str(inputs.get('path', '')),
                        'RELEASE_EVIDENCE_REQUIRED':str(inputs.get('if-no-files-found','warn')),
                        'RELEASE_EVIDENCE_OVERWRITE':str(inputs.get('overwrite','false')).lower(),
                        'RELEASE_EVIDENCE_HIDDEN':str(inputs.get('include-hidden-files','false')).lower()})
                    step['run'] = 'cd "$GITHUB_WORKSPACE" && python3 .release/collect-evidence.py'
                else:
                    step['run'] = 'echo "GitHub cache transport disabled; release checks are unchanged."'
        job.setdefault('steps', []).append({
            'name': 'Record release job result', 'if': 'always()',
            'env': {'RELEASE_WORKFLOW_ID': workflow_id, 'RELEASE_JOB_ID': job_id,
                    'RELEASE_JOB_STATUS': '${{ job.status }}', 'RELEASE_JOB_MATRIX': '${{ toJSON(matrix) }}'},
            'run': 'cd "$GITHUB_WORKSPACE" && python3 .release/record-job.py'})
    text = yaml.safe_dump(result, sort_keys=False)
    if re.search(r'\bsecrets\.', text) or 'id-token: write' in text or 'packages: write' in text:
        raise ValueError('Credentialed/publishing workflow requires a dedicated adapter')
    return result


def main(smoke=False):
    sha = os.environ['RELEASE_COMMIT']
    if not re.fullmatch('[0-9a-f]{40}', sha):
        raise ValueError('Invalid source commit')
    if (ROOT / '.release/source-commit.txt').read_text().strip() != sha:
        raise ValueError('Source revision mismatch')
    # Restore exact Git objects without a GitHub token or a network checkout.
    subprocess.run(['git', 'init', '-q'], check=True)
    with (ROOT / '.release/source.pack').open('rb') as pack:
        subprocess.run(['git', 'unpack-objects', '-q'], stdin=pack, check=True)
    (ROOT / '.git/shallow').write_text(sha + '\n')
    subprocess.run(['git', 'update-ref', 'HEAD', sha], check=True)
    subprocess.run(['git', 'reset', '--mixed', '-q', sha], check=True)
    # Restore exact committed bytes/modes from the verified Git objects. ZIP
    # extractors differ in how they preserve executable modes.
    subprocess.run(['git', 'checkout-index', '--all', '--force'], check=True)
    config = json.loads((ROOT / '.release/config.json').read_text())
    if smoke:
        config['checks']=['.release/smoke-workflow.yml']
    subprocess.run(['git', 'remote', 'add', 'origin', 'https://github.com/' + config['repository']], check=True)
    evidence = ROOT / '.release-evidence'
    evidence.mkdir(exist_ok=True)
    generated = evidence / 'workflows'
    generated.mkdir(exist_ok=True)
    selected = config['checks']
    if not selected:
        raise ValueError('No checks selected')
    # Preflight all workflows before any command runs.
    for filename in selected:
        workflow = yaml.safe_load((ROOT / filename).read_text())
        transformed = translate(workflow, Path(filename).stem)
        (generated / Path(filename).name).write_text(yaml.safe_dump(transformed, sort_keys=False))
    event = evidence / 'event.json'
    event.write_text(json.dumps({'ref': 'refs/heads/' + config['branch'], 'after': sha,
                                'repository': {'full_name': config['repository']}, 'inputs': {}}))
    statuses = []
    try:
        for filename in selected:
            log = evidence / (Path(filename).stem + '.log')
            command = ['act', 'workflow_dispatch', '--bind', '--pull=false',
                       '--concurrent-jobs', '1', '--network', 'host',
                       '--container-architecture', 'linux/amd64',
                       '-P', 'ubuntu-latest=' + config['runner_image'],
                       '-P', 'ubuntu-24.04=' + config['runner_image'],
                       '-P', 'ubuntu-22.04=' + config['runner_image'],
                       '--env', 'RELEASE_COMMIT=' + sha, '--env', 'CI=true',
                       '--eventpath', str(event), '-W', str(generated / Path(filename).name)]
            # Explicit pull before act: no interactive image selection or silent image replacement.
            subprocess.run(['docker', 'pull', config['runner_image']], check=True)
            with log.open('w') as output:
                outcome = subprocess.run(command, stdout=output, stderr=subprocess.STDOUT)
            workflow = yaml.safe_load((ROOT / filename).read_text())
            job_results = []
            for path in (evidence / 'job-results' / Path(filename).stem).glob('*.json'):
                job_results.append(json.loads(path.read_text()))
            executed = {x['job'] for x in job_results if x['status'] == 'success' and x['commit'] == sha}
            missing = set(workflow['jobs']) - executed
            if missing:
                print('Missing successful job execution evidence:', sorted(missing), file=sys.stderr)
            returncode = outcome.returncode or (1 if missing else 0)
            clean = subprocess.run(['git','diff','--quiet','HEAD','--']).returncode == 0
            if not clean:
                print('Tracked source changed during release checks; qualification rejected', file=sys.stderr)
                returncode = returncode or 1
            statuses.append({'workflow': filename, 'exit_code': returncode,
                             'log_sha256': hashlib.sha256(log.read_bytes()).hexdigest()})
            if returncode:
                print(log.read_text(errors='replace')[-20000:], file=sys.stderr)
                raise RuntimeError('Release checks failed: ' + filename)
    finally:
        (evidence / 'receipt.json').write_text(json.dumps({
            'commit': sha, 'repository': config['repository'], 'checks': statuses,
            'passed': len(statuses) == len(selected) and all(x['exit_code'] == 0 for x in statuses),
            'timestamp': int(time.time()), 'deployment_performed': False,
            'application_qualified':not smoke and not config.get('deferred_checks'),
            'scope':'infrastructure-smoke' if smoke else 'configured-Linux-release-checks'}, indent=2))


if __name__ == '__main__':
    main()
