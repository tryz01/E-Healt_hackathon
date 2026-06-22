"""Train synthetic hand-dominance classifier for hackathon demo."""

from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split

FEATURE_NAMES = [
    "left_speed",
    "left_accuracy",
    "left_quality",
    "left_success_rate",
    "right_speed",
    "right_accuracy",
    "right_quality",
    "right_success_rate",
]

CLASS_LABELS = [
    "right_dominant",
    "left_dominant",
    "learned_non_use_left",
    "learned_non_use_right",
]


def _sample_hand(base: float, spread: float, rng: np.random.Generator) -> tuple[float, float, float, float]:
    speed = np.clip(rng.normal(base, spread), 0.1, 1.0)
    accuracy = np.clip(rng.normal(base + 0.05, spread), 0.1, 1.0)
    quality = np.clip(rng.normal(base, spread * 0.8), 0.1, 1.0)
    success = np.clip(rng.normal(base + 0.1, spread), 0.1, 1.0)
    return float(speed), float(accuracy), float(quality), float(success)


def generate_sample(label: str, rng: np.random.Generator) -> list[float]:
    if label == "right_dominant":
        left = _sample_hand(0.55, 0.12, rng)
        right = _sample_hand(0.82, 0.1, rng)
    elif label == "left_dominant":
        left = _sample_hand(0.82, 0.1, rng)
        right = _sample_hand(0.55, 0.12, rng)
    elif label == "learned_non_use_left":
        left = _sample_hand(0.45, 0.15, rng)
        right = _sample_hand(0.78, 0.12, rng)
    else:  # learned_non_use_right
        left = _sample_hand(0.78, 0.12, rng)
        right = _sample_hand(0.45, 0.15, rng)
    return list(left) + list(right)


def main():
    rng = np.random.default_rng(42)
    n_per_class = 500
    X, y = [], []

    for idx, label in enumerate(CLASS_LABELS):
        for _ in range(n_per_class):
            X.append(generate_sample(label, rng))
            y.append(idx)

    X = np.array(X)
    y = np.array(y)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = RandomForestClassifier(n_estimators=100, random_state=42, max_depth=8)
    model.fit(X_train, y_train)
    accuracy = model.score(X_test, y_test)
    print(f"Test accuracy: {accuracy:.3f}")

    out_dir = Path(__file__).resolve().parent.parent / "app" / "data"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "model.joblib"
    joblib.dump(model, out_path)
    print(f"Model saved to {out_path}")


if __name__ == "__main__":
    main()
