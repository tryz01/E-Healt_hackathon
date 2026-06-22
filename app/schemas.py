from pydantic import BaseModel, Field
from typing import Literal


HandLabel = Literal["Left", "Right"]


class TrajectoryPoint(BaseModel):
    t: float
    x: float
    y: float
    hand: HandLabel


class HandAttempt(BaseModel):
    color: str
    target_x: float
    target_y: float
    target_radius: float = 80.0
    hit: bool = False
    reaction_time: float | None = None
    hit_distance: float | None = None


class TrialSubmission(BaseModel):
    session_id: str
    trial_index: int
    left: HandAttempt
    right: HandAttempt
    points: list[TrajectoryPoint] = Field(default_factory=list)
    round_duration: float | None = None


class SessionStartResponse(BaseModel):
    session_id: str


class HandScores(BaseModel):
    speed: float
    accuracy: float
    quality: float
    success_rate: float


class AnalysisResult(BaseModel):
    prediction: str
    confidence: float
    left_scores: HandScores
    right_scores: HandScores
    summary_th: str
    total_score: int
    trials_completed: int
