from pathlib import Path

import joblib
import numpy as np

MODEL_PATH = Path(__file__).resolve().parent / "data" / "model.joblib"

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

_model = None


def _load_model():
    global _model
    if _model is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                f"Model not found at {MODEL_PATH}. Run: python scripts/train_model.py"
            )
        _model = joblib.load(MODEL_PATH)
    return _model


def predict_dominance(
    left_speed: float,
    left_accuracy: float,
    left_quality: float,
    left_success_rate: float,
    right_speed: float,
    right_accuracy: float,
    right_quality: float,
    right_success_rate: float,
) -> tuple[str, float]:
    model = _load_model()
    features = np.array(
        [
            [
                left_speed,
                left_accuracy,
                left_quality,
                left_success_rate,
                right_speed,
                right_accuracy,
                right_quality,
                right_success_rate,
            ]
        ]
    )
    pred_idx = int(model.predict(features)[0])
    proba = model.predict_proba(features)[0]
    label = CLASS_LABELS[pred_idx] if pred_idx < len(CLASS_LABELS) else CLASS_LABELS[0]
    confidence = float(proba[pred_idx])
    return label, confidence
