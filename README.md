# Music Sampler

A step sequencer in the browser: program a pattern on a grid, press play, and the
transport walks column by column triggering the samples on each row.

- **Client** — React 19 + TypeScript, built with Vite, audio scheduled by Tone.js.
- **Server** — FastAPI (Python 3.12), serving the instrument catalog, the sample
  files and the saved project.

## Running it

Two processes. Start the server first so the client finds the catalog.

```bash
# server, from server/
python -m venv venv
venv\Scripts\activate          # source venv/bin/activate on macOS/Linux
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 3001
```

```bash
# client, from client/
npm install
npm run dev                    # http://localhost:5173
```

The client reads the API base URL from `VITE_API_URL` and defaults to
`http://localhost:3001`; `client/.env.example` shows the shape.

**The client also runs without the server.** If the catalog cannot be fetched it
falls back to instruments synthesised in the browser and saves to `localStorage`
instead, so the app is never a blank screen. The header says which mode it is in.

## What it does

**Grid**
- Any number of steps from 4 to 64, with 8 / 16 / 32 one click away. Resizing
  keeps whatever is already programmed.
- One row per voice. Click a cell to place a note, or hold and drag to paint a
  run of them.
- Rows come from the catalog: pick any instrument, and pitched instruments offer
  every note in their declared range.

**Transport**
- Play / stop, return to start, loop on/off, tempo (slider, typed, or tapped),
  swing, and master volume.

| Key | Does |
| --- | --- |
| `Space` | Play / stop |
| `Home` or `Backspace` | Return to the first column |
| `L` | Loop on / off |
| `Ctrl` / `Cmd` + `S` | Save now |

Space belongs to a focused control when there is one — clicking a step cell does
not take focus, so it keeps working while a pattern is being clicked in.

**Channels**
- Four instruments: a drum kit from recorded samples, plus bass, keys and pluck
  synthesised into root samples and pitch-shifted across their range.
- Per row: level, mute, solo, reorder, remove, and click the colour dot to
  audition the sound.
- Per row effects — a lowpass filter, drive, and a send into a shared reverb.

**Projects**
- Name the project, or start over from a fresh pattern.
- Autosaves to the server on a debounce, mirrored to `localStorage` on every
  edit, and reloads on boot — validated field by field before the app sees it.
  With no server reachable the mirror alone keeps the work.

## How it is put together

```
client/src/
  audio/        engine.ts        transport, per-track gain, the step sequence
                voices.ts        sample playback and the synth fallbacks
                catalog.ts       fetch the catalog, fall back when it fails
  state/        projectReducer   every edit to the project, as pure functions
                validateProject  repairs anything loaded from outside the app
  hooks/        useSampler       binds the project to the engine
                useProjectSync   load on boot, autosave after
  components/   Sequencer/  Transport/  SaveIndicator/
server/
  main.py                        the API, fully modelled with pydantic
  instruments.json               the catalog, validated at startup
  tools/generate_samples.py      synthesises the pitched instruments
```

Three decisions worth knowing about:

**Timing runs on the audio clock.** `setInterval` drifts, and browsers throttle
it to roughly one second in a background tab. Every note is scheduled against
`AudioContext.currentTime` through Tone's transport, and the playhead is drawn
via `Tone.Draw` because the audio callback fires *ahead* of the sound it
schedules.

**Each track owns a gain stage.** Level and mute are real audio routing rather
than a trigger-time trick, which is what makes solo and live level changes
behave. Sample hits allocate a buffer source each, so a long cymbal tail is not
choked by the next step.

**The catalog is data, not code.** Adding an instrument on the server — a kit
voice or a pitched instrument with root samples — needs no client change. The
client derives note lists, colours and defaults from what the server declares.
`src/api/contract.ts` asserts at compile time that the domain model still
matches the generated OpenAPI schema, so a change to a pydantic model breaks the
build rather than the demo.

## Checks

From `client/`:

```bash
npm run build      # tsc -b && vite build
npm run lint       # eslint .
npm run test       # vitest, unit tests over the project state and the catalog loader
```

All three are expected to pass clean.

The tests cover the pure logic: the reducer, the note helpers, the validation
that repairs a loaded project, and the catalog loader's fallback path. They run
in `node` — the audio engine needs a real `AudioContext`, and a mocked one would
test the mock.

## Not verified

Audio cannot be tested without a real gesture in a real browser, so playback,
timing feel and the sound of the synthesised instruments were checked by
measurement (format, peak, RMS, fundamental frequency) and by reading the code —
not by listening. Nothing here has been seen rendered either; the layout and the
contrast ratios were computed, not looked at.
