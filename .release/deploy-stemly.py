"""SSM wrapper around Stemly's existing config-preserving activation procedure."""
import base64
import contextlib
import fcntl
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import types
import urllib.request

STATE=Path('/opt/stemly/release-state')


def docker(*args):
    result=subprocess.run(['docker',*args],capture_output=True,text=True)
    if result.returncode:
        raise RuntimeError('Docker operation failed: '+args[0])
    return result.stdout.strip()


def inspect(name):
    return json.loads(docker('inspect',name))[0]


def healthy():
    for _ in range(60):
        try:
            with urllib.request.urlopen('http://127.0.0.1:8000/health',timeout=5) as response:
                if response.status==200:return
        except Exception:pass
        time.sleep(2)
    raise RuntimeError('API health did not recover')


def persist(state):
    temp=STATE/'current.json.tmp';temp.write_text(json.dumps(state,indent=2));os.chmod(temp,0o600)
    os.replace(temp,STATE/'current.json')


def recover(container_id):
    active=inspect('stemly-backend')
    if active['Id']!=container_id:
        previous=inspect(container_id)
        name=previous['Name'].lstrip('/')
        if not re.fullmatch(r'stemly-[A-Za-z0-9_-]+',name):
            raise RuntimeError('Unexpected recovery container name')
        docker('stop','--time','620','stemly-backend')
        docker('rename','stemly-backend','stemly-failed-release-'+str(time.time_ns()))
        docker('rename',name,'stemly-backend')
        docker('start','stemly-backend')
    elif not active.get('State',{}).get('Running',False):
        docker('start','stemly-backend')
    healthy()


def main(args):
    action,commit,expected_id,script64=args[:4]
    if action not in ('deploy','rollback') or not re.fullmatch('[0-9a-f]{40}',commit):
        raise ValueError('Invalid release operation')
    STATE.mkdir(mode=0o700,parents=True,exist_ok=True)
    os.chmod(STATE,0o700)
    with (STATE/'release.lock').open('w') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        current=inspect('stemly-backend')
        if current['Id']!=expected_id:
            raise RuntimeError('Production container changed; stale deployment/rollback refused')
        module=types.ModuleType('approved_stemly_activation')
        exec(compile(base64.b64decode(script64),'<qualified-stemly-activation>','exec'),module.__dict__)
        if action=='deploy':
            image=args[4]
            if not re.fullmatch(r'339712791790\.dkr\.ecr\.ap-south-1\.amazonaws\.com/stemly-backend@sha256:[0-9a-f]{64}',image):
                raise ValueError('Image is not an immutable approved repository digest')
            output=io.StringIO()
            try:
                with contextlib.redirect_stdout(output):
                    module.main(image)
                result=json.loads(output.getvalue().strip().splitlines()[-1])
                if result.get('health')!='ok':raise RuntimeError('Activation did not attest API health')
                active=inspect('stemly-backend')
                if active['Config']['Image']!=image:raise RuntimeError('Activated image identity differs')
                backup=result['rollback_container']
                old=inspect(backup)
                if old['Id']!=current['Id']:raise RuntimeError('Rollback container identity differs')
                state={'commit':commit,'current_container_id':active['Id'],'backup_container':backup,
                       'previous_container_id':old['Id'],'image':image,'timestamp':int(time.time())}
                persist(state)
            except Exception:
                recover(current['Id'])
                raise RuntimeError('Activation/receipt failed; previous container health recovered') from None
            print(json.dumps(state))
            return
        else:
            state=json.loads((STATE/'current.json').read_text())
            if state['commit']!=commit or state['current_container_id']!=expected_id:
                raise RuntimeError('Stale rollback receipt')
            backup=state['backup_container'];old=inspect(backup)
            if old['Id']!=state['previous_container_id']:raise RuntimeError('Previous container was replaced')
            held='stemly-before-rollback-'+str(time.time_ns())
            docker('stop','--time','620','stemly-backend')
            docker('rename','stemly-backend',held)
            try:
                docker('rename',backup,'stemly-backend')
                docker('start','stemly-backend')
                healthy()
                if module.scanner_required(module._runtime_env(old)) and module.live_scan_probe()!='ok':
                    raise RuntimeError('Restored upload scanner failed')
            except Exception:
                active=inspect('stemly-backend')
                if active['Id']==old['Id']:
                    docker('stop','--time','620','stemly-backend')
                    docker('rename','stemly-backend',backup)
                docker('rename',held,'stemly-backend')
                docker('start','stemly-backend')
                healthy()
                raise RuntimeError('Rollback failed; previously active container recovered') from None
            state.update(current_container_id=old['Id'],backup_container=held,
                         previous_container_id=current['Id'],timestamp=int(time.time()),rolled_back=True)
        try:
            persist(state)
        except Exception:
            recover(current['Id'])
            raise RuntimeError('Rollback receipt failed; previously active container recovered') from None
        print(json.dumps(state))


if __name__=='__main__':main(sys.argv[1:])
