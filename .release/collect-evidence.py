#!/usr/bin/env python3
"""Local artifact transport with explicit roots and directory layout."""
import glob
import os
from pathlib import Path
import re
import shutil

root = Path.cwd().resolve()
name = re.sub(r'[^A-Za-z0-9_.-]', '_', os.environ['RELEASE_EVIDENCE_NAME'])
workflow = re.sub(r'[^A-Za-z0-9_.-]', '_', os.environ.get('RELEASE_WORKFLOW_ID','checks'))
destination = root / '.release-evidence' / 'artifacts' / workflow / name
paths=[];excluded=set();anchors=[]
for raw in os.environ['RELEASE_EVIDENCE_PATHS'].splitlines():
    pattern=raw.strip()
    if not pattern:continue
    negative=pattern.startswith('!')
    if negative:pattern=pattern[1:]
    wildcard=re.search(r'[*?\[]',pattern)
    if not negative:
        if wildcard:
            prefix=pattern[:wildcard.start()]
            anchors.append((root/(Path(prefix) if prefix.endswith(('/', '\\')) else Path(prefix).parent)).resolve())
        else:
            literal=root/pattern
            anchors.append((literal if literal.is_dir() else literal.parent).resolve())
    for match in glob.glob(pattern,recursive=True):
        entry=Path(match)
        matches=entry.rglob('*') if entry.is_dir() and not entry.is_symlink() else [entry]
        for path in matches:
            if not path.is_file() or path.is_symlink():continue
            resolved=path.resolve();relative=resolved.relative_to(root)
            if '.release-evidence' in relative.parts or '.git' in relative.parts:continue
            if negative:excluded.add(resolved)
            else:paths.append(resolved)
files=sorted(set(paths)-excluded)
if not files:
    if os.environ.get('RELEASE_EVIDENCE_REQUIRED','warn')=='error':
        raise RuntimeError('Required artifact has no files: '+name)
    print('Artifact has no matching files: '+name)
else:
    if destination.exists() and os.environ.get('RELEASE_EVIDENCE_OVERWRITE','false')!='true':
        raise RuntimeError('Artifact name already uploaded in this workflow: '+name)
    anchor=Path(os.path.commonpath([str(p) for p in anchors]))
    anchor.relative_to(root)
    for source in files:
        relative=source.relative_to(anchor)
        if os.environ.get('RELEASE_EVIDENCE_HIDDEN','false')!='true' and any(p.startswith('.') for p in relative.parts):
            continue
        target=destination/relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
