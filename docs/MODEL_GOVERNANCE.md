# Model Governance

This prototype uses synthetic-only AIML/DL artifacts. The current models are decision-support references, not autonomous production decision engines.

## Implemented Artifacts

- `ml/train_model.py` generates 10,000 synthetic UPI/payment-domain rows.
- `ml/model_card.json` captures features, target, data policy, train/test split, metrics, and governance notes.
- `ml/metrics.json` captures holdout accuracy, precision, recall, F1, confusion matrix, and mean score.
- `ml/feature_importance.json` captures baseline explainability from logistic weights.

## Production Controls

- Human review for `RISK_HOLD`, `DEEMED_PENDING`, `REVERSAL`, and low-confidence decisions.
- Versioned model registry with model hash, dataset hash, threshold, owner, approval status, and rollback pointer.
- Drift monitoring for feature distribution, decision mix, score calibration, and false-positive review outcomes.
- Bias/fairness review before any lending, eligibility, fraud, or consumer-impact use case.
- No live UPI/NPCI/customer data may be used without approvals, contracts, privacy review, and regulated controls.

