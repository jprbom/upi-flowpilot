"""Read a declared earlier job artifact from this release's local transport."""
import os
from pathlib import Path
import re
import shutil

root=Path.cwd().resolve()
name=re.sub(r'[^A-Za-z0-9_.-]','_',os.environ['RELEASE_ARTIFACT_NAME'])
workflow=re.sub(r'[^A-Za-z0-9_.-]','_',os.environ['RELEASE_WORKFLOW_ID'])
source=root/'.release-evidence/artifacts'/workflow/name
target=(root/os.environ.get('RELEASE_ARTIFACT_TARGET','.')).resolve()
target.relative_to(root)
if not source.is_dir():raise RuntimeError('Required earlier job artifact is missing: '+name)
target.mkdir(parents=True,exist_ok=True)
for file in source.rglob('*'):
    if file.is_symlink():raise RuntimeError('Artifact contains a symbolic link')
    if file.is_file():
        destination=target/file.relative_to(source)
        destination.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(file,destination)
