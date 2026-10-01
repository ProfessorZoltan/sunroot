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

export interface City {
  version: 1;
  grafts: Graft[];
  /** Seeds earned and not yet spent (spending comes with Root City, Milestone 8). */
  seeds: number;
}

const KEY = 'sunroot:city';
export const EMPTY_CITY: City = { version: 1, grafts: [], seeds: 0 };

export function loadCity(storage: Storage | null): City {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return EMPTY_CITY;
    const data = JSON.parse(raw) as Partial<City>;
    return {
      version: 1,
      grafts: Array.isArray(data.grafts) ? data.grafts : [],
      seeds: typeof data.seeds === 'number' ? data.seeds : 0,
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
