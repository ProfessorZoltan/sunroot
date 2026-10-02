/**
 * The playtest log: one row per season played, kept in the browser and
 * downloadable as CSV. It ties how a season felt (notes typed during play) to
 * what happened in it (time spent, undos, cards, buildings). Nothing leaves
 * the browser unless the player downloads the file.
 */
import type { Command, Content, RunState } from '../sim';
import { scoreRun } from '../sim';

export interface SeasonRow {
  run: string;
  turn: number;
  year: number;
  season: string;
  /** Seconds from the moment the season could be played to ending it. */
  seconds: number;
  /** Seconds the season's resolution played before it ended or was skipped. */
  watched: number;
  skipped: boolean;
  commands: number;
  undos: number;
  placed: string[];
  card: string | null;
  charter: string | null;
  vision: string | null;
  hints: string[];
  notes: string[];
  /** The layers the run plays with (water, walks to work, heat). */
  layers: string[];
  /** Combos discovered as the season ended, and evolutions chosen in it. */
  discovered: string[];
  /** The run at the end of the season. */
  materials: number;
  food: number;
  citizens: number;
  wellbeing: number;
  harmony: number;
  shortfall: number;
  /** Set on a run's last season. */
  ended: string | null;
  score: number | null;
  tier: string | null;
}

const KEY = 'sunroot:playlog';
const MAX_ROWS = 5000;

export function loadLog(storage: Storage | null): SeasonRow[] {
  try {
    const data = JSON.parse(storage?.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(data) ? (data as SeasonRow[]) : [];
  } catch {
    return [];
  }
}

function saveLog(storage: Storage | null, rows: SeasonRow[]): void {
  try {
    storage?.setItem(KEY, JSON.stringify(rows.slice(-MAX_ROWS)));
  } catch {
    // Storage full or blocked: the log lasts for this visit only.
  }
}

interface Current {
  turn: number;
  startedAt: number;
  commands: number;
  undos: number;
  placed: string[];
  hints: string[];
  notes: string[];
  chosen: string[];
}

/** The layers a run plays with: from its options, or switched on in the content itself. */
function layersOf(content: Content, state: RunState): string[] {
  const o = state.options;
  const r = content.rules;
  return [
    (o.water || r.water.enabled) && 'water',
    (o.commute || r.commute.enabled) && 'walks',
    (o.localHeat || r.localHeat.gridHeat === false) && 'heat',
  ].filter((l): l is string => typeof l === 'string');
}

/** Watches play and writes a row when each season ends. */
export class PlayLog {
  rows: SeasonRow[];
  private current: Current | null = null;
  private resolvingSince: number | null = null;
  private pending: { row: SeasonRow; watchedFrom: number } | null = null;

  constructor(
    private readonly content: Content,
    private readonly storage: Storage | null,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.rows = loadLog(storage);
  }

  /** The season became playable (a run started or resumed, or a resolution ended). */
  begin(state: RunState): void {
    if (state.status !== 'active') return;
    if (this.current?.turn === state.turn) return;
    this.current = {
      turn: state.turn,
      startedAt: this.now(),
      commands: 0,
      undos: 0,
      placed: [],
      hints: [],
      notes: [],
      chosen: [],
    };
  }

  /** A command was sent; `before` is the state it was sent to. */
  command(command: Command, ok: boolean, before: RunState, after: RunState): void {
    if (!ok) return;
    if (!this.current || this.current.turn !== before.turn) this.begin(before);
    const c = this.current!;
    if (command.type === 'endSeason') {
      const r = after.lastReport!;
      const ended = after.status !== 'active';
      const score = ended ? scoreRun(this.content, after) : null;
      const row: SeasonRow = {
        run: before.options.seed,
        turn: before.turn,
        year: before.year,
        season: before.season,
        seconds: Math.round((this.now() - c.startedAt) / 100) / 10,
        watched: 0,
        skipped: false,
        commands: c.commands,
        undos: c.undos,
        placed: c.placed,
        card: before.draft.picked,
        charter: before.charters.length > 0 ? before.charters.at(-1)! : null,
        vision: before.vision,
        hints: c.hints,
        notes: c.notes,
        layers: layersOf(this.content, before),
        discovered: [
          ...new Set([
            ...c.chosen,
            ...after.discoveries.filter((id) => !before.discoveries.includes(id)),
          ]),
        ],
        materials: after.stores.materials,
        food: after.stores.food,
        citizens: after.citizens,
        wellbeing: after.wellbeing,
        harmony: after.harmony,
        shortfall: r.energy.day.shortfall + r.energy.night.shortfall,
        ended: ended ? after.status : null,
        score: score?.total ?? null,
        tier: score?.tier.id ?? null,
      };
      // The row is written once the season's resolution ends, with how long it was watched.
      this.pending = { row, watchedFrom: this.now() };
      this.current = null;
      return;
    }
    c.commands += 1;
    if (command.type === 'undo') c.undos += 1;
    if (command.type === 'place') c.placed.push(command.building);
    // Hedges and coppices are placed by their own commands; the log names them like buildings.
    if (command.type === 'plantHedge') c.placed.push('hedgerow');
    if (command.type === 'coppice') c.placed.push('coppiceWood');
    if (command.type === 'chooseEvolution') c.chosen.push(command.combo);
    if (command.type === 'buyHint') c.hints.push(command.combo);
  }

  /** The season's resolution started or ended; `skipped` when the player cut it short. */
  resolution(playing: boolean, skipped: boolean, state: RunState): void {
    if (playing) {
      this.resolvingSince ??= this.now();
      return;
    }
    this.resolvingSince = null;
    if (this.pending) {
      const { row, watchedFrom } = this.pending;
      row.watched = Math.round((this.now() - watchedFrom) / 100) / 10;
      row.skipped = skipped;
      this.write(row);
      this.pending = null;
    }
    this.begin(state);
  }

  /** A note from the player, attached to the season being played. */
  note(state: RunState, text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!this.current || this.current.turn !== state.turn) this.begin(state);
    if (this.current) this.current.notes.push(trimmed);
    else if (this.rows.length > 0) {
      // The run has ended: the note belongs to its last season.
      this.rows.at(-1)!.notes.push(trimmed);
      saveLog(this.storage, this.rows);
    }
  }

  clear(): void {
    this.rows = [];
    saveLog(this.storage, this.rows);
  }

  private write(row: SeasonRow): void {
    this.rows = [...this.rows, row];
    saveLog(this.storage, this.rows);
  }
}

const COLUMNS: (keyof SeasonRow)[] = [
  'run',
  'turn',
  'year',
  'season',
  'seconds',
  'watched',
  'skipped',
  'commands',
  'undos',
  'placed',
  'card',
  'charter',
  'vision',
  'hints',
  'notes',
  'layers',
  'discovered',
  'materials',
  'food',
  'citizens',
  'wellbeing',
  'harmony',
  'shortfall',
  'ended',
  'score',
  'tier',
];

export function logToCsv(rows: SeasonRow[]): string {
  const cell = (v: unknown) => {
    const s = Array.isArray(v) ? v.join('; ') : v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [COLUMNS.join(','), ...rows.map((r) => COLUMNS.map((c) => cell(r[c])).join(','))].join(
    '\n',
  );
}
