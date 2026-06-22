import math
from collections import defaultdict

import numpy as np

from app.predictor import predict_dominance
from app.schemas import AnalysisResult, HandScores, TrialSubmission

SUMMARY_TEMPLATES = {
    "right_dominant": (
        "มือขวาของคุณเคลื่อนไหวได้คล่อง แม่นยำ และนุ่มนวลกว่ามือซ้าย "
        "ซึ่งสอดคล้องกับการใช้มือขวาเป็นหลักในชีวิตประจำวัน"
    ),
    "left_dominant": (
        "มือซ้ายของคุณเคลื่อนไหวได้คล่อง แม่นยำ และนุ่มนวลกว่ามือขวา "
        "ซึ่งสอดคล้องกับการใช้มือซ้ายเป็นหลักในชีวิตประจำวัน"
    ),
    "learned_non_use_left": (
        "คุณใช้มือขวาได้ดีกว่ามือซ้ายอย่างชัดเจน "
        "อาจมีแนวโน้มของ Learned Non-Use ที่มือซ้าย — "
        "แนะนำให้ฝึกใช้มือซ้ายอย่างนุ่มนวลและสม่ำเสมอ"
    ),
    "learned_non_use_right": (
        "คุณใช้มือซ้ายได้ดีกว่ามือขวาอย่างชัดเจน "
        "อาจมีแนวโน้มของ Learned Non-Use ที่มือขวา — "
        "แนะนำให้ฝึกใช้มือขวาอย่างนุ่มนวลและสม่ำเสมอ"
    ),
}


def _path_length(points: list[tuple[float, float]]) -> float:
    if len(points) < 2:
        return 0.0
    total = 0.0
    for i in range(1, len(points)):
        dx = points[i][0] - points[i - 1][0]
        dy = points[i][1] - points[i - 1][1]
        total += math.hypot(dx, dy)
    return total


def _jerk_mean(times: list[float], points: list[tuple[float, float]]) -> float:
    if len(points) < 4:
        return 0.0
    xs = np.array([p[0] for p in points], dtype=float)
    ys = np.array([p[1] for p in points], dtype=float)
    ts = np.array(times, dtype=float)
    dt = np.diff(ts)
    if np.any(dt <= 0):
        return 0.0
    vx = np.diff(xs) / dt
    vy = np.diff(ys) / dt
    dt2 = dt[1:]
    if len(dt2) == 0 or np.any(dt2 <= 0):
        return 0.0
    ax = np.diff(vx) / dt2
    ay = np.diff(vy) / dt2
    dt3 = dt2[1:]
    if len(dt3) == 0 or np.any(dt3 <= 0):
        return 0.0
    jx = np.diff(ax) / dt3
    jy = np.diff(ay) / dt3
    jerks = np.sqrt(jx**2 + jy**2)
    return float(np.mean(jerks)) if len(jerks) else 0.0


def _trial_metrics(trial: TrialSubmission) -> dict[str, float | None]:
    hand_points: dict[str, list[tuple[float, float, float]]] = defaultdict(list)
    for p in trial.points:
        hand_points[p.hand].append((p.t, p.x, p.y))

    result: dict[str, float | None] = {
        "left_speed": None,
        "left_accuracy": None,
        "left_quality": None,
        "right_speed": None,
        "right_accuracy": None,
        "right_quality": None,
    }

    for hand, prefix in [("Left", "left"), ("Right", "right")]:
        pts = hand_points.get(hand, [])
        if not pts:
            continue

        hand_attempt = trial.left if hand == "Left" else trial.right
        times = [p[0] for p in pts]
        coords = [(p[1], p[2]) for p in pts]
        duration = max(times) - min(times) if len(times) > 1 else 0.001
        path_len = _path_length(coords)
        direct = math.hypot(coords[-1][0] - coords[0][0], coords[-1][1] - coords[0][1])
        path_eff = direct / path_len if path_len > 0 else 0.0
        jerk = _jerk_mean(times, coords)
        quality = (1.0 / (1.0 + jerk)) * 0.5 + path_eff * 0.5

        reaction = hand_attempt.reaction_time
        speed = 0.0
        if reaction and reaction > 0:
            speed = (1.0 / reaction) * 0.5 + (path_len / duration) * 0.001 * 0.5
        elif duration > 0:
            speed = path_len / duration * 0.001

        accuracy = 0.0
        if hand_attempt.hit:
            if hand_attempt.hit_distance is not None and hand_attempt.target_radius > 0:
                accuracy = max(0.0, 1.0 - hand_attempt.hit_distance / hand_attempt.target_radius)
            else:
                last_x, last_y = coords[-1]
                dist = math.hypot(last_x - hand_attempt.target_x, last_y - hand_attempt.target_y)
                accuracy = max(0.0, 1.0 - dist / hand_attempt.target_radius)

        result[f"{prefix}_speed"] = min(1.0, speed)
        result[f"{prefix}_accuracy"] = accuracy
        result[f"{prefix}_quality"] = min(1.0, quality)

    return result


def _aggregate_hand(trials: list[TrialSubmission], hand: str) -> HandScores:
    speeds, accuracies, qualities = [], [], []
    attempts = 0
    successes = 0

    for trial in trials:
        attempts += 1
        hand_attempt = trial.left if hand == "Left" else trial.right
        if hand_attempt.hit:
            successes += 1
        metrics = _trial_metrics(trial)
        prefix = hand.lower()
        if metrics[f"{prefix}_speed"] is not None:
            speeds.append(metrics[f"{prefix}_speed"])
        if metrics[f"{prefix}_accuracy"] is not None:
            accuracies.append(metrics[f"{prefix}_accuracy"])
        if metrics[f"{prefix}_quality"] is not None:
            qualities.append(metrics[f"{prefix}_quality"])

    def avg(vals: list[float], default: float = 0.5) -> float:
        return float(np.mean(vals)) if vals else default

    return HandScores(
        speed=round(avg(speeds), 3),
        accuracy=round(avg(accuracies), 3),
        quality=round(avg(qualities), 3),
        success_rate=round(successes / attempts, 3) if attempts else 0.0,
    )


def analyze_session(trials: list[TrialSubmission]) -> AnalysisResult:
    left = _aggregate_hand(trials, "Left")
    right = _aggregate_hand(trials, "Right")

    prediction, confidence = predict_dominance(
        left.speed,
        left.accuracy,
        left.quality,
        left.success_rate,
        right.speed,
        right.accuracy,
        right.quality,
        right.success_rate,
    )

    total_score = sum(
        int(t.left.hit) + int(t.right.hit)
        for t in trials
    )

    return AnalysisResult(
        prediction=prediction,
        confidence=round(confidence, 3),
        left_scores=left,
        right_scores=right,
        summary_th=SUMMARY_TEMPLATES.get(prediction, SUMMARY_TEMPLATES["right_dominant"]),
        total_score=total_score,
        trials_completed=len(trials),
    )
