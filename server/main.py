"""Music Sampler API.

Serves the instrument catalog, the sample WAVs and a single saved project.
Every response is modelled with pydantic because the client generates its
TypeScript types straight from /openapi.json.
"""

from __future__ import annotations

import json
import os
import re
import tempfile
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, model_validator

BASE_DIR = Path(__file__).resolve().parent
AUDIO_DIR = BASE_DIR / "audio"
DATA_DIR = BASE_DIR / "data"
STATE_FILE = DATA_DIR / "state.json"
INSTRUMENTS_FILE = BASE_DIR / "instruments.json"

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

NOTE_PATTERN = re.compile(r"^([A-G])([#b]?)(-?\d)$")
SEMITONES = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def note_to_midi(note: str) -> int:
    """Convert a scientific-pitch note name to a MIDI number."""
    match = NOTE_PATTERN.match(note)
    if not match:
        raise ValueError(f"not a scientific-pitch note name: {note!r}")
    letter, accidental, octave = match.groups()
    semitone = SEMITONES[letter] + (1 if accidental == "#" else -1 if accidental == "b" else 0)
    return (int(octave) + 1) * 12 + semitone


# ---------------------------------------------------------------------------
# Catalog models
# ---------------------------------------------------------------------------


class NoteRange(BaseModel):
    """Playable range of a pitched instrument, inclusive."""

    low: str
    high: str


class Sample(BaseModel):
    """One loadable audio file.

    For a kit, ``note`` is the voice id (``kick``). For a pitched
    instrument it is the root note name the sampler transposes from.
    """

    note: str
    label: str
    url: str


class Instrument(BaseModel):
    id: str
    name: str
    kind: Literal["kit", "pitched"]
    color: str
    # Required but nullable, not optional: every instrument states its range or
    # states that it has none, so the generated client type has no undefined case.
    noteRange: NoteRange | None
    samples: list[Sample] = Field(min_length=1)
    defaultNotes: list[str] = Field(min_length=1)


class InstrumentCatalog(BaseModel):
    instruments: list[Instrument]


# ---------------------------------------------------------------------------
# Project models
# ---------------------------------------------------------------------------


class TrackEffects(BaseModel):
    """Per-channel effect chain, normalised to 0..1 by the client."""

    tone: float = Field(default=1.0, ge=0.0, le=1.0)
    drive: float = Field(default=0.0, ge=0.0, le=1.0)
    reverb: float = Field(default=0.0, ge=0.0, le=1.0)


class Track(BaseModel):
    id: str
    instrumentId: str
    note: str
    label: str
    steps: list[bool]
    volume: float = Field(default=0.8, ge=0.0, le=1.0)
    muted: bool = False
    solo: bool = False
    # Defaulted rather than required so a project saved before effects existed
    # still loads.
    effects: TrackEffects = Field(default_factory=TrackEffects)


class Project(BaseModel):
    version: int = 2
    name: str = "Untitled"
    bpm: int = Field(default=120, ge=40, le=240)
    steps: int = Field(default=16, ge=1, le=64)
    swing: float = Field(default=0.0, ge=0.0, le=1.0)
    masterVolume: float = Field(default=0.8, ge=0.0, le=1.0)
    loop: bool = True
    tracks: list[Track]

    @model_validator(mode="after")
    def check_track_lengths(self) -> "Project":
        """Every track must be exactly as long as the pattern claims to be."""
        bad = [
            f"track {track.id!r} has {len(track.steps)} steps"
            for track in self.tracks
            if len(track.steps) != self.steps
        ]
        if bad:
            raise ValueError(
                f"every track must have exactly {self.steps} steps: " + ", ".join(bad)
            )
        return self


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"


# ---------------------------------------------------------------------------
# Catalog loading
# ---------------------------------------------------------------------------


def load_catalog() -> InstrumentCatalog:
    """Read and validate instruments.json.

    Raises on anything wrong so the process dies at startup instead of
    serving a catalog whose URLs 404 in the browser.
    """
    if not INSTRUMENTS_FILE.exists():
        raise RuntimeError(f"missing instrument catalog: {INSTRUMENTS_FILE}")

    catalog = InstrumentCatalog.model_validate_json(
        INSTRUMENTS_FILE.read_text(encoding="utf-8")
    )

    problems: list[str] = []
    seen_ids: set[str] = set()

    for instrument in catalog.instruments:
        if instrument.id in seen_ids:
            problems.append(f"duplicate instrument id {instrument.id!r}")
        seen_ids.add(instrument.id)

        sample_notes = {sample.note for sample in instrument.samples}

        for sample in instrument.samples:
            if not sample.url.startswith("/audio/"):
                problems.append(f"{instrument.id}/{sample.note}: url must start with /audio/")
                continue
            path = AUDIO_DIR / sample.url[len("/audio/") :]
            if not path.is_file():
                problems.append(f"{instrument.id}/{sample.note}: missing file {path}")

        if instrument.kind == "kit":
            if instrument.noteRange is not None:
                problems.append(f"{instrument.id}: a kit must not declare a noteRange")
            unknown = [note for note in instrument.defaultNotes if note not in sample_notes]
            if unknown:
                problems.append(f"{instrument.id}: defaultNotes not in the kit: {unknown}")
        else:
            if instrument.noteRange is None:
                problems.append(f"{instrument.id}: a pitched instrument needs a noteRange")
                continue
            try:
                low = note_to_midi(instrument.noteRange.low)
                high = note_to_midi(instrument.noteRange.high)
            except ValueError as exc:
                problems.append(f"{instrument.id}: {exc}")
                continue
            if low > high:
                problems.append(f"{instrument.id}: noteRange low is above high")
            for note in list(sample_notes) + instrument.defaultNotes:
                try:
                    midi = note_to_midi(note)
                except ValueError as exc:
                    problems.append(f"{instrument.id}: {exc}")
                    continue
                if not low <= midi <= high:
                    problems.append(f"{instrument.id}: note {note!r} is outside noteRange")

    if problems:
        raise RuntimeError(
            "instruments.json is invalid:\n  " + "\n  ".join(sorted(set(problems)))
        )

    return catalog


CATALOG = load_catalog()
INSTRUMENTS_BY_ID = {instrument.id: instrument for instrument in CATALOG.instruments}


# ---------------------------------------------------------------------------
# State persistence
# ---------------------------------------------------------------------------


def write_state(project: Project) -> None:
    """Write the save atomically so a crash mid-write cannot corrupt it."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    payload = project.model_dump_json(indent=2)
    handle = tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        dir=DATA_DIR,
        prefix=".state-",
        suffix=".tmp",
        delete=False,
    )
    try:
        with handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(handle.name, STATE_FILE)
    except BaseException:
        Path(handle.name).unlink(missing_ok=True)
        raise


def read_state() -> Project:
    if not STATE_FILE.exists():
        raise HTTPException(status_code=404, detail="No project has been saved yet")
    try:
        return Project.model_validate_json(STATE_FILE.read_text(encoding="utf-8"))
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=500, detail=f"The saved project is corrupt: {exc}"
        ) from exc


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Music Sampler API",
    version="2.0.0",
    description="Instrument catalog and project persistence for the Music Sampler client.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/audio", StaticFiles(directory=AUDIO_DIR), name="audio")


@app.get("/api/health", response_model=HealthResponse, tags=["meta"])
def health() -> HealthResponse:
    return HealthResponse()


@app.get("/api/instruments", response_model=InstrumentCatalog, tags=["instruments"])
def list_instruments() -> InstrumentCatalog:
    return CATALOG


@app.get(
    "/api/instruments/{instrument_id}",
    response_model=Instrument,
    tags=["instruments"],
)
def get_instrument(instrument_id: str) -> Instrument:
    instrument = INSTRUMENTS_BY_ID.get(instrument_id)
    if instrument is None:
        known = ", ".join(sorted(INSTRUMENTS_BY_ID))
        raise HTTPException(
            status_code=404,
            detail=f"Unknown instrument {instrument_id!r}. Known instruments: {known}",
        )
    return instrument


@app.get("/api/state", response_model=Project, tags=["state"])
def get_state() -> Project:
    return read_state()


@app.post("/api/state", response_model=Project, tags=["state"])
def save_state(project: Project) -> Project:
    write_state(project)
    return project


@app.delete("/api/state", status_code=204, response_class=Response, tags=["state"])
def delete_state() -> Response:
    STATE_FILE.unlink(missing_ok=True)
    return Response(status_code=204)
