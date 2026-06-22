from pydantic import BaseModel, Field
from typing import Literal


HandLabel = Literal["Left", "Right"]
TargetColor = Literal["red", "blue", "purple"]


class TrajectoryPoint(BaseModel):
    t: float
    x: float
    y: float
    hand: HandLabel


class TrialSubmission(BaseModel):
    session_id: str
    trial_index: int
    target_color: TargetColor
    target_x: float
    target_y: float
    target_radius: float = 80.0
    hit: bool = False
    hit_hand: HandLabel | None = None
    reaction_time: float | None = None
    points: list[TrajectoryPoint] = Field(default_factory=list)


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
