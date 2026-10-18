#!/usr/bin/env python3
"""Explicit, exact-commit AWS release entrypoint. Python standard library only."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
import zipfile
import uuid

ROOT = Path(__file__).resolve().parents[1]


def run(*args, cwd=ROOT, data=None):
    environment = dict(os.environ, PYTHONIOENCODING='utf-8', AWS_PAGER='')
    p = subprocess.run(args, cwd=cwd, input=data, stdout=subprocess.PIPE,
                       stderr=subprocess.PIPE, check=False, env=environment)
    if p.returncode:
        raise RuntimeError(p.stderr.decode(errors='replace')[-4000:] or
                           p.stdout.decode(errors='replace')[-4000:])
    return p.stdout


def aws(config, *args, payload=None):
    command = ['aws', '--region', config['region'], *args, '--output', 'json']
    if payload is None:
        return json.loads(run(*command) or b'null')
    with tempfile.TemporaryDirectory(prefix='release-request-') as tmp:
        request = Path(tmp) / 'request.json'
        request.write_text(json.dumps(payload), encoding='utf-8')
        command += ['--cli-input-json', 'file://' + request.as_posix()]
        return json.loads(run(*command) or b'null')


def git(*args):
    return run('git', *args).decode().strip()


def validate_config(config):
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', config['repository']):
        raise ValueError('Invalid repository')
    if not re.fullmatch(r'[a-z0-9-]+', config['project']):
        raise ValueError('Invalid project')
    if not config.get('checks'):
        raise ValueError('No release checks configured; refusing an empty green build')


def source_commit(config, ref, deploy):
    if git('status', '--porcelain'):
        raise ValueError('Worktree is dirty. Commit or use a clean release checkout; nothing was stashed.')
    branch = config['branch']
    git('fetch', 'origin', f'refs/heads/{branch}:refs/remotes/origin/{branch}')
    sha = git('rev-parse', ref + '^{commit}')
    if not re.fullmatch(r'[0-9a-f]{40}', sha):
        raise ValueError('Invalid commit')
    # Tests may qualify a pushed PR branch; releases must be on the protected release lineage.
    # A narrow clone's fetch refspec may omit feature refs even after a successful
    # push. Query origin itself, rather than trusting stale local tracking refs.
    heads = git('ls-remote', '--heads', 'origin')
    pushed_tip = sha in [line.split()[0] for line in heads.splitlines() if line.split()]
    if deploy or not pushed_tip:
        try:
            git('merge-base', '--is-ancestor', sha, 'origin/' + branch)
        except RuntimeError as exc:
            raise ValueError('Commit is not a pushed branch tip or an ancestor of origin/' + branch) from exc
    return sha


def package_source(sha, folder):
    """Only committed bytes: no .env, untracked datasets, credentials or local caches."""
    archive = folder / 'source.zip'
    run('git', 'archive', '--format=zip', '-o', str(archive), sha)
    objects = run('git', 'rev-list', '--objects', '--no-walk', sha)
    object_ids = b'\n'.join(row.split(b' ', 1)[0] for row in objects.splitlines()) + b'\n'
    pack = run('git', 'pack-objects', '--stdout', data=object_ids)
    with zipfile.ZipFile(archive, 'a', compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr('.release/source.pack', pack)
        z.writestr('.release/source-commit.txt', sha + '\n')
    return archive


def qualify(config, sha):
    with tempfile.TemporaryDirectory(prefix='release-source-') as tmp:
        archive = package_source(sha, Path(tmp))
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        key = f"{config['project']}/sources/{sha}/{digest}.zip"
        run('aws', '--region', config['region'], 's3', 'cp', str(archive),
            f"s3://{config['bucket']}/{key}", '--only-show-errors')
    request = {
        'projectName': config['project'], 'sourceTypeOverride': 'S3',
        'sourceLocationOverride': f"{config['bucket']}/{key}",
        'idempotencyToken': uuid.uuid4().hex,
        'environmentVariablesOverride': [
            {'name': 'RELEASE_COMMIT', 'value': sha, 'type': 'PLAINTEXT'},
            {'name': 'RELEASE_SOURCE_SHA256', 'value': digest, 'type': 'PLAINTEXT'}]}
    for attempt in range(91):
        try:
            result = aws(config, 'codebuild', 'start-build', payload=request)
            break
        except RuntimeError as exc:
            if 'AccountLimitExceededException' not in str(exc) or attempt == 90:
                raise
            if attempt == 0:
                print('Another build owns this project; waiting up to 15 minutes.', flush=True)
            time.sleep(10)
    build_id = result['build']['id']
    print('Release qualification:', build_id, flush=True)
    deadline = time.monotonic() + 3 * 3600
    while time.monotonic() < deadline:
        build = aws(config, 'codebuild', 'batch-get-builds', '--ids', build_id)['builds'][0]
        status = build['buildStatus']
        if status != 'IN_PROGRESS':
            print('CodeBuild:', status, build.get('logs', {}).get('deepLink', ''), flush=True)
            if status != 'SUCCEEDED':
                raise RuntimeError('Qualification failed; production has not been changed')
            artifact = build.get('artifacts', {}).get('location', '')
            receipt = {'commit': sha, 'build_id': build_id, 'source_key': key,
                       'source_sha256': digest, 'qualified_at': int(time.time())}
            if artifact.startswith('arn:aws:s3:::'):
                receipt['artifact_uri'] = 's3://' + artifact.removeprefix('arn:aws:s3:::')
            if config.get('package'):
                with tempfile.TemporaryDirectory(prefix='release-manifest-') as tmp:
                    path = Path(tmp)/'artifact.zip'
                    run('aws','--region',config['region'],'s3','cp',receipt['artifact_uri'],str(path),'--only-show-errors')
                    with zipfile.ZipFile(path) as archive:
                        manifest = json.loads(archive.read('.release-evidence/package.json'))
                    if manifest['commit'] != sha or manifest['repository'] != config['repository']:
                        raise RuntimeError('Build package identity mismatch; production was not changed')
                    receipt['package'] = manifest
            return receipt
        time.sleep(10)
    raise RuntimeError('Timed out waiting. Check build status before starting another release.')


def invoke_deployment(config, receipt, rollback=False):
    target = config.get('deployment', {})
    if target.get('adapter') in ('ecs-image', 'static-site', 'ssm-stemly'):
        import importlib.util
        spec = importlib.util.spec_from_file_location('cloud_release',ROOT/'.release/deploy-cloud.py')
        adapter = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(adapter)
        receipt.update(adapter.deploy(config,receipt,rollback,aws,run))
        return 'aws-'+target['adapter']
    if target.get('adapter') != 'tradeon-systemd-source':
        raise ValueError('No verified production adapter is configured. Qualification is available; deployment is blocked.')
    # Server script is taken from THIS qualified commit, not arbitrary local edits.
    import base64
    script = run('git', 'show', receipt['commit'] + ':.release/deploy-tradeon.py')
    script64 = base64.b64encode(script).decode()
    if rollback:
        args = ['rollback', receipt['commit']]
    else:
        # Short-lived source URL avoids adding S3 permissions to the application's instance role.
        url = run('aws', '--region', config['region'], 's3', 'presign',
                  f"s3://{config['bucket']}/{receipt['source_key']}", '--expires-in', '1800').decode().strip()
        args = ['deploy', receipt['commit'], receipt['source_sha256'], url]
    encoded = base64.b64encode(json.dumps(args).encode()).decode()
    command = ("python3 - <<'RELEASE_BOOTSTRAP'\nimport base64,json,os,tempfile,subprocess\n"
               f"s=base64.b64decode('{script64}'); a=json.loads(base64.b64decode('{encoded}'))\n"
               "with tempfile.TemporaryDirectory(prefix='release-') as d:\n"
               " p=os.path.join(d,'deploy.py');open(p,'wb').write(s)\n"
               " subprocess.run(['python3',p,*a],check=True)\nRELEASE_BOOTSTRAP")
    result = aws(config, 'ssm', 'send-command', payload={
        'DocumentName': 'AWS-RunShellScript', 'InstanceIds': [target['instance_id']],
        'TimeoutSeconds': 900, 'Comment': 'Exact-commit release ' + receipt['commit'],
        'Parameters': {'commands': [command], 'executionTimeout': ['900']}})
    command_id = result['Command']['CommandId']
    print('SSM command:', command_id, flush=True)
    deadline = time.monotonic() + 1000
    while time.monotonic() < deadline:
        try:
            invocation = aws(config, 'ssm', 'get-command-invocation',
                             '--command-id', command_id, '--instance-id', target['instance_id'])
        except RuntimeError as exc:
            if 'InvocationDoesNotExist' not in str(exc):
                raise
            time.sleep(2)
            continue
        if invocation['Status'] in ('Pending', 'InProgress', 'Delayed'):
            time.sleep(5)
            continue
        # Deployment script never prints the signed URL, config or credentials.
        print(invocation.get('StandardOutputContent', ''))
        if invocation['Status'] != 'Success':
            raise RuntimeError('Deployment failed. Inspect SSM ' + command_id + ': ' +
                               invocation.get('StandardErrorContent', '')[-2000:])
        return command_id
    raise RuntimeError('SSM wait expired. Do not retry blindly; inspect command ' + command_id)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['plan', 'test', 'release', 'rollback'])
    parser.add_argument('--ref', default='HEAD')
    parser.add_argument('--receipt', type=Path, help='Successful qualification/deployment receipt')
    args = parser.parse_args()
    config = json.loads((ROOT / '.release/config.json').read_text(encoding='utf-8'))
    validate_config(config)
    if args.operation == 'plan':
        print(json.dumps(config, indent=2))
        return
    if aws(config,'sts','get-caller-identity')['Account'] != config['account']:
        raise ValueError('AWS account mismatch; refusing release operation')
    target_digest=hashlib.sha256(json.dumps(config.get('deployment',{}),sort_keys=True).encode()).hexdigest()
    if args.operation == 'rollback':
        if not args.receipt:
            parser.error('rollback requires --receipt from the release being rolled back')
        receipt = json.loads(args.receipt.read_text())
        if receipt.get('repository') != config['repository']:
            raise ValueError('Receipt belongs to another repository')
        if not receipt.get('deployed'):
            raise ValueError('Receipt is not from a successful deployment')
        if receipt.get('deployment_target_digest') != target_digest:
            raise ValueError('Deployment target changed since this receipt; rollback blocked')
        invoke_deployment(config, receipt, rollback=True)
        return
    supported = ('tradeon-systemd-source','ecs-image','static-site','ssm-stemly','artifact-only')
    if args.operation == 'release' and config.get('deployment', {}).get('adapter') not in supported:
        raise ValueError('Deployment adapter is pending; run test to qualify without production mutation')
    if args.operation == 'release' and config.get('deployment',{}).get('adapter') != 'artifact-only' and config['deployment'].get('acceptance') != 'accepted':
        raise ValueError('Production adapter acceptance is pending. Test/build is available; production is unchanged.')
    sha = source_commit(config, args.ref, args.operation == 'release')
    receipt = qualify(config, sha)
    receipt['repository'] = config['repository']
    receipt['deployment_target_digest']=target_digest
    receipt['deferred_checks']=config.get('deferred_checks',[])
    destination = ROOT / '.release-local' / (sha + '.json')
    destination.parent.mkdir(exist_ok=True)
    destination.write_text(json.dumps(receipt, indent=2) + '\n')
    if args.operation == 'release' and config.get('deployment',{}).get('adapter')=='artifact-only':
        print('Release checks/artifacts complete. No application hosting is configured; nothing was deployed.')
    elif args.operation == 'release':
        receipt['ssm_command'] = invoke_deployment(config, receipt)
        receipt['deployed'] = True
        destination.write_text(json.dumps(receipt, indent=2) + '\n')
    print('Receipt:', destination)


if __name__ == '__main__':
    try:
        main()
    except (ValueError, RuntimeError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
