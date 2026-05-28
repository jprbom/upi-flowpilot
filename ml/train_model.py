"""Dependency-free AIML/DL training harness for the UPI portfolio prototypes.

The script generates 10,000 synthetic payment/UPI-domain rows, trains an
explainable logistic-regression baseline and a compact one-hidden-layer neural
network, evaluates on a holdout set, and writes reproducible governance
artifacts.

No live NPCI, bank, PSP, TPAP, PA/PG, or customer data is used.
"""

from __future__ import annotations

import json
import math
import random
import re
from pathlib import Path

FEATURES = [
    "amount_paise",
    "bank_success_rate",
    "collect_decline_rate",
    "risk_score",
    "latency_ms",
    "device_trust_score",
    "merchant_trust_score",
    "retry_count",
]
TARGET = "terminal_success"
RANDOM_SEED = 42
ROW_COUNT = 10_000


def sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-max(min(x, 35), -35)))


def project_name() -> str:
    readme = Path(__file__).resolve().parents[1] / "README.md"
    if not readme.exists():
        return "UPI Payment AI Prototype"
    match = re.search(r"<h1[^>]*>([^<]+)</h1>", readme.read_text(encoding="utf-8"))
    return match.group(1).strip() if match else "UPI Payment AI Prototype"


def synthetic_row(rng: random.Random) -> list[float | int]:
    amount = rng.randint(50, 125_000)
    bank_success = rng.uniform(0.55, 0.995)
    collect_decline = rng.uniform(0.01, 0.48)
    risk_score = rng.randint(1, 99)
    latency = rng.randint(220, 8500)
    device_trust = rng.uniform(0.15, 0.99)
    merchant_trust = rng.uniform(0.12, 0.99)
    retry_count = rng.randint(0, 4)

    logit = (
        3.2 * bank_success
        + 1.4 * device_trust
        + 1.1 * merchant_trust
        - 2.6 * collect_decline
        - 0.035 * risk_score
        - 0.00034 * latency
        - 0.22 * retry_count
        - (0.000002 * max(amount - 50_000, 0))
    )
    probability = sigmoid(logit)
    target = int(rng.random() < probability)
    return [amount, bank_success, collect_decline, risk_score, latency, device_trust, merchant_trust, retry_count, target]


def generate_rows(count: int = ROW_COUNT) -> list[list[float | int]]:
    rng = random.Random(RANDOM_SEED)
    return [synthetic_row(rng) for _ in range(count)]


def train_test_split(rows: list[list[float | int]], test_ratio: float = 0.2):
    cutoff = int(len(rows) * (1 - test_ratio))
    return rows[:cutoff], rows[cutoff:]


def normalize(train_rows, test_rows):
    columns = list(zip(*[row[:-1] for row in train_rows]))
    mins = [min(col) for col in columns]
    maxs = [max(col) for col in columns]

    def transform(rows):
      normalized = []
      for row in rows:
          xs = []
          for index, value in enumerate(row[:-1]):
              width = maxs[index] - mins[index] or 1.0
              xs.append((value - mins[index]) / width)
          normalized.append((xs, int(row[-1])))
      return normalized

    return transform(train_rows), transform(test_rows), mins, maxs


def train_logistic(data, epochs=90, lr=0.22):
    weights = [0.0 for _ in data[0][0]]
    bias = 0.0
    for _ in range(epochs):
        for xs, y in data:
            pred = sigmoid(sum(w * x for w, x in zip(weights, xs)) + bias)
            error = pred - y
            for i, x in enumerate(xs):
                weights[i] -= lr * error * x
            bias -= lr * error
    return weights, bias


def train_tiny_neural_net(data, epochs=35, lr=0.1, hidden=6):
    rng = random.Random(7)
    input_size = len(data[0][0])
    w1 = [[rng.uniform(-0.4, 0.4) for _ in range(input_size)] for _ in range(hidden)]
    b1 = [0.0 for _ in range(hidden)]
    w2 = [rng.uniform(-0.4, 0.4) for _ in range(hidden)]
    b2 = 0.0
    for _ in range(epochs):
        for xs, y in data:
            hidden_values = [sigmoid(sum(w * x for w, x in zip(row, xs)) + b1[j]) for j, row in enumerate(w1)]
            pred = sigmoid(sum(w * h for w, h in zip(w2, hidden_values)) + b2)
            output_error = pred - y
            for j, h in enumerate(hidden_values):
                w2[j] -= lr * output_error * h
            b2 -= lr * output_error
            for j in range(hidden):
                hidden_error = output_error * w2[j] * hidden_values[j] * (1 - hidden_values[j])
                for i, x in enumerate(xs):
                    w1[j][i] -= lr * hidden_error * x
                b1[j] -= lr * hidden_error
    return {"w1": w1, "b1": b1, "w2": w2, "b2": b2}


def predict_logistic(model, xs):
    weights, bias = model
    return sigmoid(sum(w * x for w, x in zip(weights, xs)) + bias)


def predict_nn(model, xs):
    hidden = [sigmoid(sum(w * x for w, x in zip(row, xs)) + model["b1"][j]) for j, row in enumerate(model["w1"])]
    return sigmoid(sum(w * h for w, h in zip(model["w2"], hidden)) + model["b2"])


def evaluate(data, predictor):
    tp = tn = fp = fn = 0
    scores = []
    for xs, y in data:
        score = predictor(xs)
        pred = int(score >= 0.5)
        scores.append(score)
        if pred == 1 and y == 1:
            tp += 1
        elif pred == 0 and y == 0:
            tn += 1
        elif pred == 1 and y == 0:
            fp += 1
        else:
            fn += 1
    total = len(data)
    precision = tp / (tp + fp or 1)
    recall = tp / (tp + fn or 1)
    return {
        "accuracy": round((tp + tn) / total, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(2 * precision * recall / (precision + recall or 1), 4),
        "confusion_matrix": {"tp": tp, "tn": tn, "fp": fp, "fn": fn},
        "mean_score": round(sum(scores) / len(scores), 4),
    }


def main():
    rows = generate_rows()
    train_rows, test_rows = train_test_split(rows)
    train_data, test_data, mins, maxs = normalize(train_rows, test_rows)
    logistic = train_logistic(train_data)
    neural = train_tiny_neural_net(train_data)
    logistic_metrics = evaluate(test_data, lambda xs: predict_logistic(logistic, xs))
    neural_metrics = evaluate(test_data, lambda xs: predict_nn(neural, xs))
    feature_importance = {
        feature: round(abs(weight), 5)
        for feature, weight in sorted(zip(FEATURES, logistic[0]), key=lambda item: abs(item[1]), reverse=True)
    }
    report = {
        "project": project_name(),
        "target": TARGET,
        "features": FEATURES,
        "row_count": len(rows),
        "split": {"train": len(train_rows), "test": len(test_rows)},
        "data_policy": "Synthetic portfolio data only; no live NPCI/bank/PSP/TPAP/PA/PG/customer data.",
        "models": {
            "aiml_logistic_regression": {
                "test_metrics": logistic_metrics,
                "weights": [round(value, 5) for value in logistic[0]],
                "bias": round(logistic[1], 5),
            },
            "dl_tiny_neural_network": {
                "test_metrics": neural_metrics,
                "hidden_units": len(neural["w1"]),
            },
        },
        "normalization": {"min": mins, "max": maxs},
        "governance": {
            "serving_mode": "prototype artifact only",
            "human_review_required_for": ["RISK_HOLD", "DEEMED_PENDING", "REVERSAL", "LOW_CONFIDENCE"],
            "drift_monitoring": "compare weekly feature distributions and decision-rate deltas against this synthetic baseline",
        },
    }
    output_dir = Path(__file__).resolve().parent
    (output_dir / "model_card.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    (output_dir / "metrics.json").write_text(json.dumps({"logistic": logistic_metrics, "neural": neural_metrics}, indent=2), encoding="utf-8")
    (output_dir / "feature_importance.json").write_text(json.dumps(feature_importance, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
