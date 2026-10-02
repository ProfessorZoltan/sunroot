import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/sim';
import willowReach from '../src/content/willow-reach.json';

/** Buildings added by docs/proposals/heat-routes.md, beyond the design's 23. */
const HEAT_PROPOSAL = ['heatPump', 'solarThermalCollector'];
/** Blueprints only a Root City district adds to the draft (the Cider Press). */
const CITY_CARDS = ['ciderPress'];

const clone = () => structuredClone(willowReach) as typeof willowReach;

describe('content validation', () => {
  it("loads Willow Reach: the camp, the design's 23 buildings and 2 from the heat proposal", () => {
    const content = loadContent(willowReach);
    // Water buildings come from EXPANSION.md, not the design's 23.
    const buildings = content.buildings.filter(
      (b) => b.id !== content.campBuilding && !b.requiresWater && !b.requiresHeatLayer,
    );
    // Evolved buildings (Milestone 6) are not among the 23: they come from evolutions.
    expect(
      buildings.filter(
        (b) => !HEAT_PROPOSAL.includes(b.id) && !CITY_CARDS.includes(b.id) && b.placeable,
      ),
    ).toHaveLength(23);
    expect(HEAT_PROPOSAL.every((id) => content.byId[id])).toBe(true);
    expect(content.byId.floodplainFarm?.yields.food).toEqual([2, 4, 5, 0]);
  });

  it("matches the design doc's energy table", () => {
    const { byId } = loadContent(willowReach);
    const table: Record<
      string,
      [number, [number, number, number, number], [number, number, number, number]]
    > = {
      solarCanopy: [4, [3, 4, 2, 1], [0, 0, 0, 0]],
      riverWheel: [6, [3, 1, 2, 2], [3, 1, 2, 2]],
      windSpire: [8, [2, 1, 3, 3], [3, 1, 4, 4]],
      foundersCamp: [0, [2, 2, 2, 2], [2, 2, 2, 2]],
    };
    for (const [id, [cost, day, night]] of Object.entries(table)) {
      expect(byId[id]!.cost, id).toBe(cost);
      expect(byId[id]!.generation?.day, id).toEqual(day);
      expect(byId[id]!.generation?.night, id).toEqual(night);
    }
  });

  it('rejects bad numbers with a readable message', () => {
    const bad = clone();
    bad.buildings[1]!.cost = -3;
    expect(() => loadContent(bad)).toThrow(/buildings\.1\.cost/);
  });

  it('rejects unknown fields, so typos in data files are caught', () => {
    const bad = clone() as unknown as { buildings: Record<string, unknown>[] };
    bad.buildings[1]!.costt = 3;
    expect(() => loadContent(bad)).toThrow(/costt/);
  });

  it('rejects references to buildings that do not exist', () => {
    const bad = clone();
    bad.guidedYear[0] = ['orchard', 'unicornStable'];
    expect(() => loadContent(bad)).toThrow(/unicornStable/);
  });
});
