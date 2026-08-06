# Music Sampler server

FastAPI service that serves the instrument catalog, the sample WAVs and a single
saved project. The client generates its TypeScript types from `/openapi.json`.

## Setup

From `server/`:

```bash
python -m venv venv
venv\Scripts\activate        # Windows;  source venv/bin/activate on macOS/Linux
pip install -r requirements.txt
```

## Run

From `server/`:

```bash
python -m uvicorn main:app --reload --port 3001
```

Interactive docs at <http://localhost:3001/docs>, raw schema at
<http://localhost:3001/openapi.json>.

## Endpoints

| Method   | Path                            | Notes                                          |
| -------- | ------------------------------- | ---------------------------------------------- |
| `GET`    | `/api/health`                   | `{"status": "ok"}`                              |
| `GET`    | `/api/instruments`              | The whole catalog                               |
| `GET`    | `/api/instruments/{id}`         | One instrument, `404` if unknown                |
| `GET`    | `/api/state`                    | The saved project, `404` if nothing saved yet   |
| `POST`   | `/api/state`                    | Save, returns the saved project                 |
| `DELETE` | `/api/state`                    | `204`, idempotent                               |
| `GET`    | `/audio/...`                    | Static sample files                             |

`404` from `GET /api/state` is a normal state, not an error: it means the user
has not saved anything yet.

`POST /api/state` returns `422` if any track's `steps` array length differs from
the project's `steps` count, or if `bpm`, `swing`, `volume` or `masterVolume`
fall outside their allowed ranges.

`instruments.json` is loaded and validated at startup. If a `url` points at a
file that does not exist, the process refuses to start.

## Regenerating the samples

The `bass`, `keys` and `pluck` WAVs are synthesized, not recorded. The script is
standard-library only and deterministic, so re-running it reproduces the exact
same bytes. From `server/`:

```bash
python tools/generate_samples.py           # write audio/{bass,keys,pluck}/*.wav
python tools/generate_samples.py --check   # verify format, peak and RMS only
```

Drum samples in `audio/drums/` are recorded files and are not touched by the
script.
