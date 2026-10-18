"""Infrastructure acceptance only; explicitly NOT application qualification."""
import json
import os
from pathlib import Path
import qualify

try:
    qualify.main(smoke=True)
finally:
    # A smoke receipt must never be mistaken for production release acceptance.
    receipt = Path('.release-evidence/receipt.json')
    if receipt.exists():
        state = json.loads(receipt.read_text())
        state['application_qualified'] = False
        state['scope'] = 'release-pipeline-infrastructure-smoke'
        receipt.write_text(json.dumps(state, indent=2))
