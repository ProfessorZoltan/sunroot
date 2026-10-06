/**
 * Rainforest Gardens on screen (FG4, proposals/rainforest-gardens.md): what the interface says
 * about the forest. A field's fertility and the monsoon, dark earth, a garden's layers (and the
 * inspector's buttons to add them), a midden's way to dark earth, the dry season's fire, the
 * season report's lines, the marks, and the season's playback. Drawing is checked in e2e; here,
 * the data it draws.
 */
import { describe, expect, it } from 'vitest';
import { biomeContent } from '../src/content';
import { hexKey, projectSeason, type RunState, type Season, type TileType } from '../src/sim';
import {
  forestAt,
  forestNotes,
  forestOutlook,
  forestSummary,
  layerChoices,
} from '../src/game/forestInfo';
import { mapMarks, reachSummary } from '../src/game/marks';
import { buildTimeline } from '../src/game/timeline';
import { layerLooks } from '../src/render/forestArt';
import { at, endSeason, scenario } from './helpers';

const F = biomeContent('rainforestGardens');

// One tile of forest beside a field of scrub; meadow round the camp.
const GLADE = ['~ m m m m', '~ m C m ,', '~ m m m W', '~ m m m m'];
function start(season: Season = 'summer', rows = GLADE): RunState {
  return scenario(rows, {
    content: F,
    season,
    citizens: 20,
    stores: { food: 200, materials: 200, scraps: 10, biomass: 10 },
  });
}
const now = (s: RunState) => projectSeason(F, s, s.season, { forecast: true });
const tile = (s: RunState, col: number, row: number) => s.map.tiles[hexKey(at(col, row))]!;
let n = 0;
function put(s: RunState, type: string, col: number, row: number, on?: TileType): string {
  const uid = `s${++n}`;
  if (on) tile(s, col, row).type = on;
  s.buildings[uid] = { uid, type, at: at(col, row), builtTurn: s.turn - 8 };
  s.priority.push(uid);
  return uid;
}

describe('the forest in the tooltip', () => {
  it("a field's fertility, and the monsoon to come", () => {
    const s = start('summer');
    put(s, 'milpa', 4, 1);
    tile(s, 4, 1).fertility = 2;
    expect(forestAt(F, s, now(s), at(4, 1))).toEqual([
      'Fertility 2 of 4: +2 food.',
      'The monsoon will wash 1 fertility out of it this season. Compost puts it back.',
    ]);
    tile(s, 4, 1).fertility = 0;
    expect(forestAt(F, s, now(s), at(4, 1))).toEqual([
      'No fertility left: it makes ×0.5 food, and each monsoon wears its land a step down.',
      'This monsoon wears its land a step down: it has no fertility left.',
    ]);
  });

  it('dark earth, and a garden covered by its canopy', () => {
    const s = start('summer');
    const g = put(s, 'forestGarden', 2, 3, 'darkEarth');
    s.buildings[g]!.layers = [{ id: 'canopy', turn: s.turn - 4 }];
    expect(forestAt(F, s, now(s), at(2, 3))).toEqual([
      'Dark earth: it keeps its fertility for good, and a farm on it makes 1 more food.',
      'Fertility 4 of 4.',
      'Canopy: grown.',
    ]);
    tile(s, 2, 3).type = 'meadow';
    s.buildings[g]!.layers = [{ id: 'canopy', turn: s.turn - 1 }];
    expect(forestAt(F, s, now(s), at(2, 3))).toContain('Canopy: growing, 1 of 4 seasons.');
  });

  it("a midden's way to dark earth", () => {
    const s = start('spring');
    put(s, 'kitchenMidden', 1, 1);
    expect(forestAt(F, s, now(s), at(1, 1))).toEqual([
      'Dark earth: 0 of 4 seasons; not fed this season (it needs 2 scraps and a char hearth burning within 2).',
    ]);
    put(s, 'charHearth', 1, 2);
    expect(forestAt(F, s, now(s), at(1, 1))).toEqual([
      'Dark earth: 1 of 4 seasons, fed this season.',
    ]);
  });

  it('where the dry season’s fire could catch', () => {
    const s = start('winter');
    expect(forestAt(F, s, now(s), at(4, 2))).toEqual([
      'Fire may catch here this dry season, from the cleared ground beside it. A living fence along that edge keeps it out.',
    ]);
  });

  it('is silent outside the forest', () => {
    const reach = biomeContent('willowReach');
    const s = scenario(['~ , , ,', '~ , C ,'], { content: reach });
    expect(forestAt(reach, s, null, at(1, 0))).toEqual([]);
    expect(forestOutlook(reach, s, null)).toBeNull();
  });
});

describe("a garden's layers in the inspector", () => {
  it('each added, growing or to add, and why not yet', () => {
    const s = start('spring');
    const g = put(s, 'forestGarden', 2, 3);
    s.buildings[g]!.layers = [{ id: 'canopy', turn: s.turn - 1 }];
    expect(layerChoices(F, s, g)).toEqual([
      { id: 'shrub', name: 'Shrub layer', cost: 2, added: false, grown: false, problem: null },
      { id: 'understory', name: 'Understory', cost: 3, added: false, grown: false, problem: null },
      { id: 'canopy', name: 'Canopy', cost: 4, added: true, grown: false, problem: null },
    ]);
    s.buildings[g]!.layers = [{ id: 'canopy', turn: s.turn }];
    expect(layerChoices(F, s, g)[0]!.problem).toBe(
      'the Forest Garden takes one layer a season: add its shrub layer next season',
    );
    expect(layerChoices(F, s, 'b0')).toEqual([]);
  });

  it('drawn as far grown as they are', () => {
    const s = start('spring');
    const g = put(s, 'forestGarden', 2, 3);
    s.buildings[g]!.layers = [
      { id: 'understory', turn: s.turn - 1 },
      { id: 'canopy', turn: s.turn - 2 },
    ];
    expect(layerLooks(F, s, s.buildings[g]!)).toEqual([
      { id: 'understory', grown: 1 },
      { id: 'canopy', grown: 0.5 },
    ]);
  });
});

describe('the forest in the left panel, the banner and the marks', () => {
  it('the monsoon: the fields it will wash', () => {
    const s = start('summer');
    put(s, 'milpa', 4, 1);
    const forecast = now(s);
    const o = forestOutlook(F, s, forecast)!;
    expect(o).toMatchObject({ fields: 1, bare: 0, washing: 1, fireRisk: 0 });
    expect(forestSummary(o, 'flood')).toBe('1 field will lose fertility');
    const marks = mapMarks(F, s, forecast).filter((m) => m.kind === 'wash');
    expect(marks.map((m) => hexKey(m.at))).toEqual([hexKey(at(4, 1))]);
    expect(reachSummary(marks)).toBe('1 fields lose fertility');
  });

  it('the dry season: the tiles fire could catch, and none under the Living Mosaic', () => {
    const s = start('winter');
    const o = forestOutlook(F, s, now(s))!;
    expect(o.fireRisk).toBe(1);
    expect(forestSummary(o, 'fire')).toBe('fire could catch on 1 tile');
    const marks = mapMarks(F, s, now(s)).filter((m) => m.kind === 'fire');
    expect(marks.map((m) => hexKey(m.at))).toEqual([hexKey(at(4, 2))]);
    expect(reachSummary(marks)).toBe('fire could catch on 1 tiles');
    expect(forestSummary({ ...o, fireStopped: true }, 'fire')).toBe(
      'the Living Mosaic: no fire can start',
    );
  });
});

describe('the forest in the season report and its playback', () => {
  it('sums up the washing, the dark earth, the fire and the felling', () => {
    expect(
      forestNotes(
        {
          leached: ['1,1', '2,1'],
          wornOut: ['3,1'],
          charcoal: ['h'],
          middens: { m: 2 },
          darkened: ['4,1'],
        },
        ['5,1'],
        ['g'],
      ),
    ).toEqual([
      'The rain washed 1 fertility out of 2 fields.',
      '1 field with no fertility left wore a step down the land.',
      '1 kitchen midden fed, on the way to dark earth.',
      '1 tile turned to dark earth, for good.',
      'Fire burned 1 tile of rainforest to scrub.',
      'The cyclone felled the canopy of 1 forest garden.',
    ]);
  });

  it('the monsoon washes the fields as it crosses; fire burns the forest by the clearing', () => {
    let s = start('summer');
    put(s, 'milpa', 4, 1);
    s = endSeason(s, F);
    let tl = buildTimeline(F, s, s.lastReport!);
    expect(tl.eventFx.filter((f) => f.kind === 'washed').map((f) => hexKey(f.at))).toEqual([
      hexKey(at(4, 1)),
    ]);
    expect(tl.pops.map((p) => p.text)).toContain('−1 fertility');
    let w = start('winter');
    w = endSeason(w, F);
    tl = buildTimeline(F, w, w.lastReport!);
    expect(tl.eventFx.filter((f) => f.kind === 'burned').map((f) => hexKey(f.at))).toEqual([
      hexKey(at(4, 2)),
    ]);
    expect(tl.pops.map((p) => p.text)).toContain('fire');
  });

  it('dark earth spreads where a midden turns a tile', () => {
    let s = start('spring');
    const m = put(s, 'kitchenMidden', 1, 1);
    put(s, 'charHearth', 1, 2);
    s.buildings[m]!.darkening = 3;
    s = endSeason(s, F);
    const tl = buildTimeline(F, s, s.lastReport!);
    expect(tl.eventFx.filter((f) => f.kind === 'darkened')).toHaveLength(1);
    expect(tl.pops.map((p) => p.text)).toContain('dark earth');
  });
});
