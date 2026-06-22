from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.requests import Request

from app.metrics import analyze_session
from app.schemas import AnalysisResult, SessionStartResponse, TrialSubmission

BASE_DIR = Path(__file__).resolve().parent.parent
SESSIONS: dict[str, list[TrialSubmission]] = {}

app = FastAPI(title="Hand Dexterity Assessment")
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return templates.TemplateResponse(request, "index.html")


@app.post("/api/session/start", response_model=SessionStartResponse)
def start_session():
    session_id = str(uuid4())
    SESSIONS[session_id] = []
    return SessionStartResponse(session_id=session_id)


@app.post("/api/session/trial")
def submit_trial(trial: TrialSubmission):
    if trial.session_id not in SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found")
    SESSIONS[trial.session_id].append(trial)
    return {"ok": True, "trial_count": len(SESSIONS[trial.session_id])}


@app.post("/api/session/analyze", response_model=AnalysisResult)
def analyze(session_id: str):
    if session_id not in SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found")
    trials = SESSIONS[session_id]
    if not trials:
        raise HTTPException(status_code=400, detail="No trials recorded")
    return analyze_session(trials)
