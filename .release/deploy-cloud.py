"""Immutable AWS deployment adapters; preserve secrets and reject stale rollbacks."""
import base64
import copy
import hashlib
import io
import json
from pathlib import Path
import tempfile
import time
import urllib.request
import zipfile
import uuid
import re


def exact_health(url, sha, path):
    with urllib.request.urlopen(url, timeout=15) as response:
        value = json.load(response)
    for part in path:
        value = value[part]
    if value != sha:
        raise RuntimeError('Endpoint does not attest the deployed commit')


def basic_health(url):
    with urllib.request.urlopen(url, timeout=15) as response:
        if response.status != 200:
            raise RuntimeError('Restored application health failed')


def ecs(config, receipt, rollback, aws):
    target = config['deployment']
    def service():
        result = aws(config,'ecs','describe-services','--cluster',target['cluster'],
                     '--services',target['service'])
        if result.get('failures') or len(result['services']) != 1:
            raise RuntimeError('ECS service lookup failed')
        return result['services'][0]
    current = service()['taskDefinition']
    if rollback:
        if current != receipt['deployed_task']:
            raise RuntimeError('Stale ECS rollback receipt')
        desired = receipt['previous_task']
    else:
        definition = aws(config,'ecs','describe-task-definition','--task-definition',current)['taskDefinition']
        allowed = {'family','taskRoleArn','executionRoleArn','networkMode','containerDefinitions','volumes',
                   'placementConstraints','requiresCompatibilities','cpu','memory','pidMode','ipcMode',
                   'proxyConfiguration','inferenceAccelerators','ephemeralStorage','runtimePlatform',
                   'enableFaultInjection'}
        request = {key:value for key,value in definition.items() if key in allowed}
        containers = [c for c in request['containerDefinitions'] if c['name'] == target['container']]
        if len(containers) != 1:
            raise RuntimeError('Expected ECS container missing')
        container = containers[0]
        previous_commit = next((x['value'] for x in container.get('environment',[])
                                if x['name']=='CHROMATIME_BUILD_SOURCE_SHA'), None)
        required = set(target.get('required_secret_names',[]))
        if not required.issubset({s['name'] for s in container.get('secrets',[])}):
            raise RuntimeError('Existing required secret bindings are missing; refusing to rewrite secrets')
        container['image'] = receipt['package']['image']
        overrides = {key:value.replace('{commit}',receipt['commit']).replace('{digest}',receipt['package']['image_digest'])
                     for key,value in target.get('attestation_environment',{}).items()}
        # Only image/declared source attestation fields change. Existing credentials,
        # task roles, secret bindings, resource limits and all other fields survive.
        container['environment'] = [e for e in container.get('environment',[]) if e['name'] not in overrides]
        container['environment'] += [{'name':k,'value':v} for k,v in overrides.items()]
        desired = aws(config,'ecs','register-task-definition',payload=request)['taskDefinition']['taskDefinitionArn']
    def switch(task):
        aws(config,'ecs','update-service',payload={'cluster':target['cluster'],
            'service':target['service'],'taskDefinition':task})
        deadline=time.monotonic()+900
        while time.monotonic()<deadline:
            state=service()
            deployments=state['deployments']
            if state['taskDefinition'] != task:
                raise RuntimeError('ECS deployment was superseded')
            failed=[d for d in deployments if d['taskDefinition']==task and d.get('rolloutState')=='FAILED']
            if failed:raise RuntimeError('ECS rollout failed')
            if len(deployments)==1 and state['runningCount']==state['desiredCount'] and not state['pendingCount']:
                return
            time.sleep(10)
        raise RuntimeError('ECS stabilization timeout')
    try:
        switch(desired)
        if not rollback:
            exact_health(target['health_url'],receipt['commit'],target['health_commit_path'])
        else:
            basic_health(target['health_url'])
    except Exception:
        # Do not roll back over an unrelated operator's newer task definition.
        if service()['taskDefinition'] == desired:
            switch(current)
            basic_health(target['health_url'])
        raise
    return {'previous_task':current,'deployed_task':desired}


def static_site(config, receipt, rollback, aws, run):
    target=config['deployment'];distribution=target['distribution']
    current=aws(config,'cloudfront','get-distribution-config','--id',distribution)
    definition=current['DistributionConfig'];etag=current['ETag']
    origins=[o for o in definition['Origins']['Items'] if o['Id']==target['origin_id']]
    if len(origins)!=1:raise RuntimeError('CloudFront origin identity mismatch')
    origin=origins[0];previous=origin.get('OriginPath','')
    if rollback:
        if previous != receipt['deployed_origin_path']:
            raise RuntimeError('Stale CloudFront rollback receipt')
        desired=receipt['previous_origin_path']
    else:
        desired='/releases/'+receipt['commit']
        if previous==desired:
            raise RuntimeError('Release is already active; previous rollback target would be lost')
        with tempfile.TemporaryDirectory(prefix='release-site-') as tmp:
            archive=Path(tmp)/'artifact.zip'
            run('aws','--region',config['region'],'s3','cp',receipt['artifact_uri'],str(archive),'--only-show-errors')
            site=Path(tmp)/'site';site.mkdir()
            with zipfile.ZipFile(archive) as package:
                prefix='.release-evidence/package/'
                for member in package.infolist():
                    if not member.filename.startswith(prefix) or member.is_dir():continue
                    relative=Path(member.filename[len(prefix):])
                    if relative.is_absolute() or '..' in relative.parts:
                        raise RuntimeError('Unsafe package path')
                    file=site/relative;file.parent.mkdir(parents=True,exist_ok=True)
                    file.write_bytes(package.read(member))
            proof=json.loads((site/'release-version.json').read_text())
            if proof['commit'] != receipt['commit'] or not (site/'index.html').exists():
                raise RuntimeError('Site package source identity mismatch')
            # Never sync/delete the bucket root or overwrite an existing release prefix.
            existing=aws(config,'s3api','list-objects-v2','--bucket',target['bucket'],
                         '--prefix',desired.lstrip('/')+'/', '--max-keys','1')
            if existing.get('KeyCount',0):
                raise RuntimeError('Immutable release prefix already exists; inspect before retrying')
            run('aws','--region',config['region'],'s3','sync',str(site),
                's3://'+target['bucket']+desired+'/', '--only-show-errors')
    origin['OriginPath']=desired
    def apply(value, expected):
        update=aws(config,'cloudfront','update-distribution',payload={
            'Id':distribution,'IfMatch':expected,'DistributionConfig':value})
        aws(config,'cloudfront','create-invalidation',payload={
            'DistributionId':distribution,'InvalidationBatch':{'Paths':{'Quantity':1,'Items':['/*']},
            'CallerReference':str(time.time_ns())}})
        deadline=time.monotonic()+900
        while time.monotonic()<deadline:
            state=aws(config,'cloudfront','get-distribution','--id',distribution)['Distribution']
            if state['Status']=='Deployed':break
            time.sleep(10)
        else:raise RuntimeError('CloudFront distribution update did not stabilize')
        return update
    try:
        update=apply(definition,etag)
        if not rollback:
            last=None
            for attempt in range(60):
                try:
                    exact_health(target['health_url'].rstrip('/')+'/release-version.json',receipt['commit'],['commit'])
                    break
                except Exception as error:
                    last=error;time.sleep(10)
            else:raise RuntimeError('Edge exact-source health failed') from last
        else:
            basic_health(target['health_url'])
    except Exception:
        latest=aws(config,'cloudfront','get-distribution-config','--id',distribution)
        row=next(o for o in latest['DistributionConfig']['Origins']['Items'] if o['Id']==target['origin_id'])
        if row.get('OriginPath','')==desired:
            row['OriginPath']=previous
            apply(latest['DistributionConfig'],latest['ETag'])
            basic_health(target['health_url'])
        raise
    return {'previous_origin_path':previous,'deployed_origin_path':desired}


def stemly(config,receipt,rollback,aws,run):
    target=config['deployment']
    def ssm(command):
        response=aws(config,'ssm','send-command',payload={
            'DocumentName':'AWS-RunShellScript','InstanceIds':[target['instance_id']],
            'TimeoutSeconds':1800,'Parameters':{'commands':[command],'executionTimeout':['1800']}})
        command_id=response['Command']['CommandId'];deadline=time.monotonic()+1900
        while time.monotonic()<deadline:
            try:
                result=aws(config,'ssm','get-command-invocation','--command-id',command_id,
                           '--instance-id',target['instance_id'])
            except RuntimeError as exc:
                if 'InvocationDoesNotExist' not in str(exc):raise
                time.sleep(2);continue
            if result['Status'] in ('Pending','InProgress','Delayed'):
                time.sleep(5);continue
            if result['Status']!='Success':
                raise RuntimeError('Stemly SSM operation failed; inspect command '+command_id)
            return json.loads(result['StandardOutputContent'].strip().splitlines()[-1])
        raise RuntimeError('SSM wait expired; inspect command '+command_id+' before retrying')
    if rollback:
        expected=receipt['current_container_id']
    else:
        baseline=ssm("python3 - <<'PY'\nimport json,subprocess\ns=json.loads(subprocess.check_output(['docker','inspect','stemly-backend']))[0]\nprint(json.dumps({'id':s['Id'],'image':s['Config']['Image'],'labels':s['Config'].get('Labels') or {}}))\nPY")
        expected=baseline['id']
        previous=baseline['labels'].get('org.opencontainers.image.revision')
        if not previous:
            match=re.search(r':([0-9a-f]{40})$',baseline['image'])
            previous=match.group(1) if match else None
        if not previous:raise RuntimeError('Existing container source cannot be identified; deployment blocked')
        try:
            run('git','cat-file','-e',previous+'^{commit}')
        except RuntimeError:
            run('git','fetch','--depth=1','origin',previous)
        changed=run('git','diff','--name-only',previous,receipt['commit']).decode().splitlines()
        for path in changed:
            if re.search(r'(^|/)(migrations?|alembic|database|db|models)(/|\.|$)',path,re.I):
                raise RuntimeError('Schema/model persistence change requires separate rollback qualification: '+path)
    original=run('git','show',receipt['commit']+':infra/path-a/box/deploy-cpu-backend.py')
    wrapper=run('git','show',receipt['commit']+':.release/deploy-stemly.py')
    args=['rollback' if rollback else 'deploy',receipt['commit'],expected,base64.b64encode(original).decode()]
    if not rollback:args.append(receipt['package']['image'])
    encoded=base64.b64encode(json.dumps(args).encode()).decode()
    code=base64.b64encode(wrapper).decode()
    command=("python3 - <<'PY'\nimport base64,json,sys\n"
             f"sys.argv=['release',*json.loads(base64.b64decode('{encoded}'))]\n"
             f"exec(compile(base64.b64decode('{code}'),'<release>','exec'))\nPY")
    return ssm(command)


def deploy(config,receipt,rollback,aws,run):
    # S3 conditional creation serializes operator deployments without an idle
    # runner/database. A crashed operator leaves a visible lock for inspection;
    # never auto-break a lock and risk overlapping production mutations.
    key=config['project']+'/locks/production.json'
    with tempfile.TemporaryDirectory(prefix='release-lock-') as tmp:
        body=Path(tmp)/'lock.json'
        body.write_text(json.dumps({'owner':uuid.uuid4().hex,'commit':receipt['commit'],
                                    'timestamp':int(time.time()),'build_id':receipt['build_id']}))
        acquired=json.loads(run('aws','--region',config['region'],'s3api','put-object',
            '--bucket',config['bucket'],'--key',key,'--body',str(body),'--if-none-match','*','--output','json'))
    try:
        adapter=config['deployment']['adapter']
        if adapter=='ecs-image':result=ecs(config,receipt,rollback,aws)
        elif adapter=='static-site':result=static_site(config,receipt,rollback,aws,run)
        elif adapter=='ssm-stemly':result=stemly(config,receipt,rollback,aws,run)
        else:raise ValueError('Unsupported cloud adapter')
        state=dict(receipt,**result)
        try:
            with tempfile.TemporaryDirectory(prefix='release-receipt-') as tmp:
                body=Path(tmp)/'receipt.json'
                body.write_text(json.dumps(state,indent=2))
                run('aws','--region',config['region'],'s3','cp',str(body),
                    f"s3://{config['bucket']}/{config['project']}/deployments/{receipt['commit']}.json",'--only-show-errors')
        except Exception as exc:
            try:
                if adapter=='ecs-image':ecs(config,state,True,aws)
                elif adapter=='static-site':static_site(config,state,True,aws,run)
                elif adapter=='ssm-stemly':stemly(config,state,True,aws,run)
            except Exception as recovery:
                raise RuntimeError('Receipt persistence AND recovery failed; inspect production before retrying') from recovery
            raise RuntimeError('Receipt persistence failed; previous release restored') from exc
        return result
    finally:
        if not acquired.get('VersionId'):
            raise RuntimeError('Versioned deployment lock missing; inspect lock before another release')
        aws(config,'s3api','delete-object','--bucket',config['bucket'],'--key',key,
            '--version-id',acquired['VersionId'])
