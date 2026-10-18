#!/usr/bin/env python3
"""Provision a release-only CodeBuild project. No webhooks or deployment credentials."""
import argparse
import json
from pathlib import Path
import time
from release import ROOT, aws, validate_config


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-only",action="store_true",help="Reuse the already provisioned shared artifact bucket")
    options=parser.parse_args()
    config = json.loads((ROOT / '.release/config.json').read_text())
    validate_config(config)
    region, name, bucket = config['region'], config['project'], config['bucket']
    account = aws(config, 'sts', 'get-caller-identity')['Account']
    if account != config['account']:
        raise RuntimeError('AWS account mismatch')
    if not options.project_only:
        # Bucket is a dedicated release resource; never changes an application's bucket.
        buckets = aws(config, 's3api', 'list-buckets')['Buckets']
        if not any(b['Name'] == bucket for b in buckets):
            request = {'Bucket': bucket}
            if region != 'us-east-1':
                request['CreateBucketConfiguration'] = {'LocationConstraint': region}
            aws(config, 's3api', 'create-bucket', payload=request)
        aws(config, 's3api', 'put-public-access-block', payload={
            'Bucket': bucket, 'PublicAccessBlockConfiguration': {
                'BlockPublicAcls': True, 'IgnorePublicAcls': True,
                'BlockPublicPolicy': True, 'RestrictPublicBuckets': True}})
        aws(config, 's3api', 'put-bucket-encryption', payload={
            'Bucket': bucket, 'ServerSideEncryptionConfiguration': {'Rules': [
                {'ApplyServerSideEncryptionByDefault': {'SSEAlgorithm': 'AES256'}}]}})
        aws(config, 's3api', 'put-bucket-versioning', payload={
            'Bucket': bucket, 'VersioningConfiguration': {'Status': 'Enabled'}})
        aws(config, 's3api', 'put-bucket-lifecycle-configuration', payload={
            'Bucket': bucket, 'LifecycleConfiguration': {'Rules': [
                {'ID': 'bounded-release-retention', 'Filter': {'Prefix': ''}, 'Status': 'Enabled',
                 'Expiration': {'Days': 90}, 'NoncurrentVersionExpiration': {'NoncurrentDays': 7},
                 'AbortIncompleteMultipartUpload': {'DaysAfterInitiation': 1}}]}})
    project_arn = f'arn:aws:codebuild:{region}:{account}:project/{name}'
    role_name = name + '-build'
    trust = {'Version': '2012-10-17', 'Statement': [{
        'Effect': 'Allow', 'Principal': {'Service': 'codebuild.amazonaws.com'},
        'Action': 'sts:AssumeRole', 'Condition': {
            'StringEquals': {'aws:SourceAccount': account},
            'ArnEquals': {'aws:SourceArn': project_arn}}}]}
    try:
        role = aws(config, 'iam', 'get-role', '--role-name', role_name)['Role']
    except RuntimeError as exc:
        if 'NoSuchEntity' not in str(exc):
            raise
        role = aws(config, 'iam', 'create-role', payload={
            'RoleName': role_name, 'AssumeRolePolicyDocument': json.dumps(trust),
            'Description': 'Release qualification only; no production access'})['Role']
    log_group = '/aws/codebuild/' + name
    log_arn = f'arn:aws:logs:{region}:{account}:log-group:{log_group}'
    policy = {'Version': '2012-10-17', 'Statement': [
        {'Effect': 'Allow', 'Action': ['s3:GetObject', 's3:GetObjectVersion'],
         'Resource': f'arn:aws:s3:::{bucket}/{name}/sources/*'},
        {'Effect': 'Allow', 'Action': ['s3:PutObject', 's3:GetObject'],
         'Resource': f'arn:aws:s3:::{bucket}/{name}/evidence/*'},
        {'Effect': 'Allow', 'Action': ['s3:GetBucketLocation', 's3:GetBucketAcl'],
         'Resource': f'arn:aws:s3:::{bucket}'},
        {'Effect': 'Allow', 'Action': ['logs:CreateLogStream', 'logs:PutLogEvents'],
         'Resource': log_arn + ':*'}]}
    package = config.get('package', {})
    if package.get('type') == 'docker-ecr':
        policy['Statement'] += [
            {'Effect':'Allow','Action':'ecr:GetAuthorizationToken','Resource':'*'},
            {'Effect':'Allow','Action':['ecr:BatchCheckLayerAvailability','ecr:InitiateLayerUpload',
                'ecr:UploadLayerPart','ecr:CompleteLayerUpload','ecr:PutImage','ecr:DescribeImages',
                'ecr:BatchGetImage','ecr:GetDownloadUrlForLayer'],
             'Resource':f"arn:aws:ecr:{region}:{account}:repository/{package['repository']}"}]
    aws(config, 'iam', 'put-role-policy', payload={
        'RoleName': role_name, 'PolicyName': 'release-artifacts-only',
        'PolicyDocument': json.dumps(policy)})
    try:
        aws(config, 'logs', 'create-log-group', '--log-group-name', log_group)
    except RuntimeError as exc:
        if 'ResourceAlreadyExistsException' not in str(exc):
            raise
    aws(config, 'logs', 'put-retention-policy', '--log-group-name', log_group,
        '--retention-in-days', '14')
    request = {
        'name': name, 'description': 'Explicit release checks; GitHub is source/versioning only',
        'source': {'type': 'S3', 'location': f'{bucket}/{name}/sources/bootstrap.zip',
                   'buildspec': '.release/buildspec.yml'},
        'artifacts': {'type': 'S3', 'location': bucket, 'path': name + '/evidence',
                      'namespaceType': 'BUILD_ID', 'name': 'qualification.zip', 'packaging': 'ZIP'},
        'environment': {'type': 'LINUX_CONTAINER', 'image': 'aws/codebuild/standard:7.0',
                        'computeType': 'BUILD_GENERAL1_MEDIUM', 'privilegedMode': True,
                        'imagePullCredentialsType': 'CODEBUILD'},
        'serviceRole': role['Arn'], 'timeoutInMinutes': 120, 'queuedTimeoutInMinutes': 15,
        'concurrentBuildLimit': 1,
        'logsConfig': {'cloudWatchLogs': {'status': 'ENABLED', 'groupName': log_group}},
        'tags': [{'key': 'ManagedBy', 'value': 'release-only'},
                 {'key': 'Repository', 'value': config['repository']}]}
    existing = aws(config, 'codebuild', 'batch-get-projects', '--names', name)['projects']
    if existing:
        aws(config, 'codebuild', 'update-project', payload=request)
    else:
        # IAM propagation can lag project creation; retries create no builds.
        for attempt in range(6):
            try:
                aws(config, 'codebuild', 'create-project', payload=request)
                break
            except RuntimeError as exc:
                if attempt == 5 or 'assume' not in str(exc).lower():
                    raise
                time.sleep(5)
    print(json.dumps({'project': name, 'region': region, 'webhook': False,
                      'build_started': False, 'production_permissions': False}))


if __name__ == '__main__':
    main()
