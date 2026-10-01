# Sunroot

A solarpunk settlement builder of short, replayable runs. Each run heals one damaged region, and what
it sends home grows a permanent city. The full design is in [docs/DESIGN.md](docs/DESIGN.md).

Built so far: the simulation core, the balance simulator, the map, the interface, the season
resolution, and combos with the Almanac (Milestones 0 to 6 of the build plan). A whole run of Willow Reach can be played to the end with mouse or
keyboard. See [CHANGELOG.md](CHANGELOG.md) and [docs/DECISIONS.md](docs/DECISIONS.md).

## Getting started

```sh
npm install
npm run dev      # the game at http://localhost:5173
npm test         # unit tests, including the Year 1 golden test
npm run e2e      # browser tests (Playwright)
npm run check    # typecheck, lint, format check and unit tests
npm run balance  # balance simulator: 4,000 bot runs -> balance-out/runs.csv and report.md
```

URL options: `?seed=<text>` replays a run, `?sandbox` unlocks every building with 999 materials,
`?guided=0` skips the guided first year.

## Playing

Pick one of three blueprint cards, then build: choose a building on the right and hover the map.
The ghost shows exactly what it would do this season, including effects on its neighbours. Click
to place; Esc or right-click stops. Undo is free until the season ends. Every number at the top
and on the left has a tooltip with its full math. Click a building to inspect and adjust it. End
the season when you're ready; the year strip shows each season's energy and forecasts the rest of
the year with what you have now. Each season then plays out on the map in about 5 seconds: Space
skips it, P pauses it.

Buildings combine: neighbours help each other, loops of buildings earn a lasting bonus, hidden shapes
and evolutions wait to be discovered. Each discovery goes into the Almanac (A), which keeps them
across runs. Tunings join the draft, and each new era offers a charter.

Keyboard: 1–4 pick a card, letters on the palette pick a building, arrow keys aim, N jumps to the
next legal site, Enter places, Z undoes, E ends the season, Space skips its resolution, A opens
the Almanac, ? lists every key.

## Layout

| Path           | What lives there                                                                              |
| -------------- | --------------------------------------------------------------------------------------------- |
| `src/sim/`     | The pure, deterministic simulation core. No rendering, no clock, one seeded random generator. |
| `src/content/` | All game content and numbers as JSON, validated with Zod at load.                             |
| `src/balance/` | The balance simulator: bots, the run recorder, the report and the command line.               |
| `src/game/`    | The client store, the numbers the interface shows, and each season's resolution timeline.     |
| `src/render/`  | The PixiJS map: procedural tiles and buildings, seasons, wildlife, the resolution player.     |
| `src/ui/`      | The Preact interface.                                                                         |
| `src/main.tsx` | The web client's entry point.                                                                 |
| `tests/`       | Unit tests and the Year 1 golden test.                                                        |
| `e2e/`         | Browser tests, including a whole run played with the keyboard.                                |
| `docs/`        | The design, `DECISIONS.md`, design proposals and balance reports.                             |

## Using the simulation

```ts
import { applyCommand, createRun, loadContent } from './src/sim';
import willowReach from './src/content/willow-reach.json';

const content = loadContent(willowReach); // validates the data
let state = createRun(content, { seed: 'my-seed', guided: true });
const result = applyCommand(content, state, { type: 'pickCard', card: state.draft.offer[0] });
if (result.ok) state = result.state; // otherwise result.error says why
```

Commands never mutate the state they are given. `state.lastReport` explains the last season:
energy per slot, every building's yield and the math behind it, blackouts and wellbeing changes.
`previewPlacement` and `projectSeason` answer "what if" questions without changing anything. The
same seed and the same commands always give the same run, and a state survives `JSON.stringify`,
so saves are just serialized state.

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
