/**
 * Grafts sent home to Root City. Milestone 8 builds the city from these; for
 * now each finished run records the district it sent, kept in the browser.
 */
export interface Graft {
  district: string;
  tier: string;
  score: number;
  /** Seeds the run earned. */
  seeds: number;
  seed: string;
  vision: string | null;
  visionAchieved: boolean;
  /** When it was sent (ISO time). */
  sentAt: string;
}

/** How a finished run was sent home: its Seeds, and its Graft if it was planted. */
export interface RunResult {
  /** Null when the Seeds in hand couldn't pay for planting: the Seeds are banked. */
  graft: Graft | null;
  /** Seeds the run earned, and Seeds spent planting its Graft. */
  earned: number;
  spent: number;
}

export interface City {
  version: 1;
  grafts: Graft[];
  /** Seeds in hand: earned and not yet spent. */
  seeds: number;
  /** Runs finished and sent home, planted or not. */
  runs: number;
}

const KEY = 'sunroot:city';
export const EMPTY_CITY: City = { version: 1, grafts: [], seeds: 0, runs: 0 };

export function loadCity(storage: Storage | null): City {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return EMPTY_CITY;
    const data = JSON.parse(raw) as Partial<City>;
    return {
      version: 1,
      grafts: Array.isArray(data.grafts) ? data.grafts : [],
      seeds: typeof data.seeds === 'number' ? data.seeds : 0,
      runs: typeof data.runs === 'number' ? data.runs : 0,
    };
  } catch {
    return EMPTY_CITY;
  }
}

export function saveCity(storage: Storage | null, city: City): void {
  try {
    storage?.setItem(KEY, JSON.stringify(city));
  } catch {
    // Storage blocked or full: the Graft is kept for this visit only.
  }
}

/** The city after a run is sent home. */
export function applyRunResult(city: City, result: RunResult): City {
  return {
    version: 1,
    grafts: result.graft ? [...city.grafts, result.graft] : city.grafts,
    seeds: city.seeds + result.earned - result.spent,
    runs: city.runs + 1,
  };
}
