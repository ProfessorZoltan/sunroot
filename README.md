# Sunroot

A solarpunk settlement builder of short, replayable runs. Each run heals one damaged region, and what
it sends home grows a permanent city. The full design is in [docs/DESIGN.md](docs/DESIGN.md).

## Getting started

```sh
npm install
npm run dev      # the game at http://localhost:5173 (?seed=..., ?sandbox, ?guided=0)
npm test         # Vitest, including the Year 1 golden test
npm run check    # typecheck, lint, format check and tests (what CI runs)
npm run e2e      # browser tests (Playwright)
npm run balance  # balance simulator: 4,000 bot runs -> balance-out/runs.csv and report.md
```

## Layout

| Path           | What lives there                                                                              |
| -------------- | --------------------------------------------------------------------------------------------- |
| `src/sim/`     | The pure, deterministic simulation core. No rendering, no clock, one seeded random generator. |
| `src/content/` | All game content and numbers as JSON, validated with Zod at load.                             |
| `src/main.ts`  | The web client (a blank page until Milestone 3).                                              |
| `tests/`       | Unit tests and the Year 1 golden test.                                                        |
| `docs/`        | The design doc and `DECISIONS.md` (rules the design leaves open).                             |

## Balance simulator

```sh
npm run balance                                   # 1000 seeds x 4 bots, all CPU cores
npm run balance -- --runs 200 --bots greedyFood,balanced --out my-dir --jobs 2 --seed try2
```

Bots play through the same commands a player uses. `runs.csv` has one row per run (score, survival,
idle seasons, blackouts, food made, eaten and rotted, energy by source, wellbeing lost by cause,
picks, buildings). `report.md` summarizes it and answers the design's balance questions. Results
depend only on the seeds, not on the number of threads. The last full report is kept in
[docs/balance/baseline-report.md](docs/balance/baseline-report.md).
