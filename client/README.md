# Music Sampler — client

React 19 + TypeScript on Vite. Audio is scheduled by Tone.js. See the
[project README](../README.md) for what the app does and how the pieces fit.

## Scripts

```bash
npm run dev        # dev server on http://localhost:5173
npm run build      # tsc -b && vite build
npm run lint       # eslint .
npm run test       # vitest run
npm run preview    # serve the production build
npm run gen:api    # regenerate src/api/schema.d.ts from the running server
```

`gen:api` needs the FastAPI server up on port 3001; it reads
`http://localhost:3001/openapi.json`.

## Configuration

| Variable       | Default                 | Purpose               |
| -------------- | ----------------------- | --------------------- |
| `VITE_API_URL` | `http://localhost:3001` | Base URL for the API. |

Copy `.env.example` to `.env` to override it. Without a reachable server the app
falls back to browser-synthesised instruments and `localStorage`.

## Layout

| Path              | What lives there                                              |
| ----------------- | ------------------------------------------------------------- |
| `src/audio/`      | Tone.js engine, voices, catalog loading and the offline fallback |
| `src/state/`      | The project reducer, factories, validation, note helpers       |
| `src/hooks/`      | Engine binding, persistence, keyboard shortcuts, tap tempo     |
| `src/components/` | `Sequencer/`, `Transport/`, `SaveIndicator/`                   |
| `src/api/`        | Fetch wrappers and the generated OpenAPI schema                |
