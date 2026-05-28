"""Dependency-free AIML/DL training example for UPI FlowPilot.

This script trains two small models on synthetic UPI-domain data:
1. Logistic regression baseline for explainable AIML scoring.
2. One-hidden-layer neural network as a compact DL-style sequence/risk learner.

It writes ml/model_card.json so the repository has a reproducible training artifact.
No real UPI, NPCI, bank, PSP, or customer data is used.
"""

from __future__ import annotations

import json
import math
import random
from pathlib import Path

FEATURES = ["amount","bank_success_rate","collect_decline_rate","risk_score","latency_ms"]
TARGET = "payment_success"
ROWS = [[240,0.9,0.31,18,890,1],[8600,0.94,0.12,31,4100,0],[440,0.99,0.04,9,620,1],[2450,0.96,0.09,18,1380,1],[3200,0.88,0.28,42,7200,0]]


def sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-max(min(x, 35), -35)))


def normalize(rows):
    columns = list(zip(*[row[:-1] for row in rows]))
    mins = [min(col) for col in columns]
    maxs = [max(col) for col in columns]
    normalized = []
    for row in rows:
        xs = []
        for index, value in enumerate(row[:-1]):
            width = maxs[index] - mins[index] or 1.0
            xs.append((value - mins[index]) / width)
        normalized.append((xs, row[-1]))
    return normalized, mins, maxs


def train_logistic(data, epochs=900, lr=0.18):
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


def train_tiny_neural_net(data, epochs=700, lr=0.12, hidden=4):
    random.seed(7)
    input_size = len(data[0][0])
    w1 = [[random.uniform(-0.4, 0.4) for _ in range(input_size)] for _ in range(hidden)]
    b1 = [0.0 for _ in range(hidden)]
    w2 = [random.uniform(-0.4, 0.4) for _ in range(hidden)]
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


def accuracy(data, predictor):
    correct = 0
    for xs, y in data:
        correct += int((predictor(xs) >= 0.5) == bool(y))
    return correct / len(data)


def main():
    data, mins, maxs = normalize(ROWS)
    logistic = train_logistic(data)
    neural = train_tiny_neural_net(data)
    report = {
        "project": "UPI FlowPilot",
        "target": TARGET,
        "features": FEATURES,
        "data_policy": "Synthetic portfolio data only; no live UPI/NPCI/bank/PSP/customer data.",
        "models": {
            "aiml_logistic_regression": {
                "accuracy_on_synthetic_training_set": round(accuracy(data, lambda xs: predict_logistic(logistic, xs)), 3),
                "weights": [round(value, 4) for value in logistic[0]],
                "bias": round(logistic[1], 4)
            },
            "dl_tiny_neural_network": {
                "accuracy_on_synthetic_training_set": round(accuracy(data, lambda xs: predict_nn(neural, xs)), 3),
                "hidden_units": len(neural["w1"])
            }
        },
        "normalization": {"min": mins, "max": maxs}
    }
    output = Path(__file__).with_name("model_card.json")
    output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
