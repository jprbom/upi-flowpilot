# UPI FlowPilot AIML/DL Training

This folder contains dependency-free Python training code for the repository's synthetic data story.

Run:

```bash
python ml/train_model.py
```

The script now generates 10,000 synthetic UPI/payment-domain rows and trains:

- an explainable AIML logistic-regression baseline
- a compact one-hidden-layer neural-network model that represents the DL layer
- reproducible `model_card.json`, `metrics.json`, and `feature_importance.json` artifacts with holdout-test metrics, confusion matrix, features, target, and data-policy notes

The training data is intentionally synthetic and safe for portfolio demos. It is not connected to UPI rails, NPCI, PSPs, banks, Account Aggregator systems, or customer data.
