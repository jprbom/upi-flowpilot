"""Build immutable deploy artifacts only after every configured release check passed."""
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
from release import ROOT, aws, run


def main():
    config = json.loads((ROOT/'.release/config.json').read_text())
    package = config.get('package')
    if not package:
        return
    sha = os.environ['RELEASE_COMMIT']
    proof = json.loads((ROOT/'.release-evidence/receipt.json').read_text())
    if not proof['passed'] or proof['commit'] != sha:
        raise RuntimeError('No exact-commit successful qualification')
    for command in package.get('preflight', []):
        run(*command)
    manifest = {'commit':sha, 'repository':config['repository'], 'type':package['type']}
    if package['type'] == 'docker-ecr':
        repository = package['repository']
        registry = f"{config['account']}.dkr.ecr.{config['region']}.amazonaws.com"
        image = registry+'/'+repository
        password = run('aws','--region',config['region'],'ecr','get-login-password')
        run('docker','login','--username','AWS','--password-stdin',registry,data=password)
        command = ['docker','build','--file',package['dockerfile'],
                   '--label','org.opencontainers.image.revision='+sha,'--tag',image+':'+sha]
        for key, value in package.get('build_args',{}).items():
            command += ['--build-arg', key+'='+value.replace('{commit}',sha)]
        command.append(package['context'])
        run(*command)
        run('docker','push',image+':'+sha)
        details = aws(config,'ecr','describe-images','--repository-name',repository,
                      '--image-ids','imageTag='+sha)['imageDetails'][0]
        digest = details['imageDigest']
        if not re.fullmatch(r'sha256:[0-9a-f]{64}',digest):
            raise RuntimeError('Missing immutable image digest')
        manifest.update({'image':image+'@'+digest,'image_digest':digest})
    elif package['type'] == 'static-site':
        source = (ROOT/package['directory']).resolve()
        source.relative_to(ROOT)
        if not (source/'index.html').is_file():
            raise RuntimeError('No compiled site index.html')
        target = ROOT/'.release-evidence/package'
        target.mkdir(exist_ok=True)
        for path in source.rglob('*'):
            if path.is_symlink():
                raise ValueError('Symlinks are not deployable site artifacts')
            if path.is_file():
                destination = target/path.relative_to(source)
                destination.parent.mkdir(parents=True,exist_ok=True)
                shutil.copy2(path,destination)
        (target/'release-version.json').write_text(json.dumps({'commit':sha}))
    else:
        raise ValueError('Unknown package type')
    (ROOT/'.release-evidence/package.json').write_text(json.dumps(manifest,indent=2))


if __name__ == '__main__':
    main()
