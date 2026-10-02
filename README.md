# Sunroot

A solarpunk settlement builder of short, replayable runs. Each run heals one damaged region, and what
it sends home grows a permanent city. The full design is in [docs/DESIGN.md](docs/DESIGN.md).

Built so far: the simulation core, the balance simulator, the map, the interface, the season
resolution, combos with the Almanac, the run's structure (eras, visions, scoring and the Graft),
Root City between runs, and sound (Milestones 0 to 9 of the build plan), drawn with hand-made
papercraft art ([docs/ART.md](docs/ART.md)). Runs of Willow Reach can
be played one after another with mouse or keyboard, growing Root City; the run in progress and the
city are saved and resumed. See [CHANGELOG.md](CHANGELOG.md) and [docs/DECISIONS.md](docs/DECISIONS.md).

## Getting started

```sh
npm install
npm run dev      # the game at http://localhost:5173
npm test         # unit tests, including the Year 1 golden test
npm run e2e      # browser tests (Playwright)
npm run check    # typecheck, lint, format check and unit tests
npm run balance  # balance simulator: 4,000 bot runs -> balance-out/runs.csv and report.md
```

The run in progress and Root City are saved in the browser as you play, and opening the game again
continues where you were. **New run** at the bottom abandons the run in progress.

URL options: `?city` shows Root City, `?new` starts the city's next run, `?seed=<text>` starts a run
with that seed outside the city's teaching and expeditions (`?guided=0` then skips the guided first
year, `?visions=0` the vision choice and `?water=1` turns on water, which otherwise joins at run
2), and `?sandbox` unlocks every building with 999 materials (sandbox runs are never saved and
never reach the city).

## Playtesting

Every season played is logged in the browser: time spent, undos, cards, buildings and the run's
state. Press **Note** to jot down how a season felt; it is logged with that season. **Keys** (or ?)
→ **Download CSV** saves the log.

## Playing

A run is 12 years of 4 seasons, in 4 eras: Settle, Mend, Flourish and Bloom. At the end the score
sets the tier of the Graft, a district for Root City (you choose which of the two that match how you
played), and the Seeds the run earns. Planting the Graft costs Seeds; Seeds that can't pay for it
are banked.

Between runs, in Root City: place the Graft in a slot around the Heartwood, spend Seeds to raise
districts' tiers, and choose the next expedition: a region (a variation of the valley: lakes, a
broad floodplain, an old town, high banks...), a twist (a Drought Year makes the run harder and
the Graft a tier higher; Rich Silt trades bigger harvests for dearer repairs) and a city request
worth bonus Seeds. Districts give each run a
perk and add a card to its draft; some neighbouring districts form hidden landmarks. Fill all 18
slots with 6 districts at Heartwood to grow the Sun Tree. After a Heartwood Graft, Tempest levels open one by one: each adds a lasting
hardship, more Seeds, and a Tempest mark on the district. New systems join run by run: tunings from
run 2, charters at each new era from run 3, and a vision (a goal for the run) from run 4.

Pick one of three blueprint cards, then build: choose a building on the right and every tile it
can go on lights up; hover the map.
The ghost shows exactly what it would do this season, including effects on its neighbours. Click
to place; Esc or right-click stops. Undo is free until the season ends. Every number at the top
and on the left has a tooltip with its full math. Click a building to inspect and adjust it. End
the season when you're ready; the year strip shows each season's energy and forecasts the rest of
the year with what you have now. Each season then plays out on the map in about 7 seconds: Space
skips it, P pauses it. The map marks how far the coming event reaches (dashed) and what lasts for
the season, like silt on flooded farms (solid); hover a tile for what each mark means.

Later in a run, when the blueprints run out, the draft offers refinements to the buildings you
have; from era 3 you can start projects with your spare stores, and citizens begin to expect civic
life (a Commons Plaza, a library) while the seasons grow harsher. **Fast-forward** (Shift+E) ends
seasons up to next spring, pausing for each choice.

Buildings combine: neighbours help each other, loops of buildings earn a lasting bonus, hidden shapes
and evolutions wait to be discovered. Each discovery goes into the Almanac (A), which keeps them
across runs.

Sound starts with your first click or key press: buildings play notes, combos play chords, and
the music gains an instrument at each Harmony tier. **Sound** in the footer turns it off; the keys
panel (?) has the volumes.

**Report** at the bottom shows what made and used each resource in the last of each season.
Click a building to inspect it; Delete demolishes it (for some energy and rubble). Damaged
buildings are repaired automatically at the start of a season while you have the materials; a
building's panel can put its repairs on hold and repair it later.

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
| `src/audio/`   | Sound: the music as data, what plays when, and the Web Audio engine that synthesizes it.      |
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
so saves are just serialized state: `makeSave` wraps one in a versioned envelope and
`readSave` checks one before it is used.

## Balance simulator

```sh
npm run balance                                   # 1000 seeds x 4 bots, all CPU cores
npm run balance -- --runs 200 --bots greedyFood,balanced --out my-dir --jobs 2 --seed try2 --sight outcome
```

Bots play through the same commands a player uses. `runs.csv` has one row per run (score, survival,
idle seasons, blackouts, food made, eaten and rotted, energy by source, wellbeing lost by cause,
picks, buildings). `report.md` summarizes it and answers the design's balance questions. Results
depend only on the seeds, not on the number of threads. The last full report is kept in
[docs/balance/baseline-report.md](docs/balance/baseline-report.md).

`npx tsx scripts/water.ts [runs] [bot] [setting=value ...]` plays the valley with and without the
water system (off in the game until it can be seen) and reports the E1 decision gate; see
[docs/balance/water-e1.md](docs/balance/water-e1.md).
