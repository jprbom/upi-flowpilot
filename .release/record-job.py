"""Positive execution evidence prevents an entirely skipped workflow from passing."""
import hashlib
import json
import os
from pathlib import Path
import re

workflow = os.environ['RELEASE_WORKFLOW_ID']
job = os.environ['RELEASE_JOB_ID']
for value in (workflow, job):
    if not re.fullmatch(r'[A-Za-z0-9_.-]+', value):
        raise ValueError('Invalid job evidence path')
matrix = os.environ.get('RELEASE_JOB_MATRIX', '')
variant = hashlib.sha256(matrix.encode()).hexdigest()[:16]
folder = Path('.release-evidence/job-results') / workflow
folder.mkdir(parents=True, exist_ok=True)
(folder / (job+'-'+variant+'.json')).write_text(json.dumps({
    'job': job, 'status': os.environ['RELEASE_JOB_STATUS'], 'matrix': matrix,
    'commit': os.environ['RELEASE_COMMIT']}, indent=2))
