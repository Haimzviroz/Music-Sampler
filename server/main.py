import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

BASE_DIR = Path(__file__).parent
STATE_FILE = BASE_DIR / "data" / "state.json"
INSTRUMENTS_FILE = BASE_DIR / "instruments.json"

app = FastAPI(title="Music Sampler API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/audio", StaticFiles(directory=BASE_DIR / "audio"), name="audio")


class SamplerState(BaseModel):
    bpm: int = 120
    columns: int = 16
    grid: dict[str, list[list[bool]]]  # instrument -> rows -> steps
    volume: float = 0.8


@app.get("/api/instruments")
def get_instruments():
    return json.loads(INSTRUMENTS_FILE.read_text(encoding="utf-8"))


@app.get("/api/state")
def get_state():
    if not STATE_FILE.exists():
        raise HTTPException(status_code=404, detail="No saved state")
    return json.loads(STATE_FILE.read_text(encoding="utf-8"))


@app.post("/api/state")
def save_state(state: SamplerState):
    STATE_FILE.parent.mkdir(exist_ok=True)
    STATE_FILE.write_text(state.model_dump_json(indent=2), encoding="utf-8")
    return {"ok": True}