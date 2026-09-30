# Sunroot

A solarpunk settlement builder of short, replayable runs. Each run heals one damaged region, and what
it sends home grows a permanent city. The full design is in [docs/DESIGN.md](docs/DESIGN.md).

## Getting started

```sh
npm install
npm run dev      # blank page at http://localhost:5173
npm test         # Vitest, including the Year 1 golden test
npm run check    # typecheck, lint, format check and tests (what CI runs)
```

## Layout

| Path           | What lives there                                                                              |
| -------------- | --------------------------------------------------------------------------------------------- |
| `src/sim/`     | The pure, deterministic simulation core. No rendering, no clock, one seeded random generator. |
| `src/content/` | All game content and numbers as JSON, validated with Zod at load.                             |
| `src/main.ts`  | The web client (a blank page until Milestone 3).                                              |
| `tests/`       | Unit tests and the Year 1 golden test.                                                        |
| `docs/`        | The design doc and `DECISIONS.md` (rules the design leaves open).                             |
