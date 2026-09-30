/** Turns run records into a CSV and a short Markdown report. */
import type { RunRecord } from './runner';

const GENERATORS = [
  'foundersCamp',
  'solarCanopy',
  'riverWheel',
  'windSpire',
  'biogasDigester',
] as const;
const SEASON_NAMES = ['spring', 'summer', 'autumn', 'winter'];

// ---------------------------------------------------------------- CSV

type Column = readonly [string, (r: RunRecord) => string | number];

export function toCsv(records: RunRecord[]): string {
  const sources = [
    ...new Set([...GENERATORS, ...records.flatMap((r) => Object.keys(r.energyBySource))]),
  ];
  const columns: Column[] = [
    ['seed', (r) => r.seed],
    ['bot', (r) => r.bot],
    ['status', (r) => r.status],
    ['seasons', (r) => r.seasons],
    ['score', (r) => r.score],
    ['citizens', (r) => r.citizens],
    ['peak_citizens', (r) => r.peakCitizens],
    ['wellbeing', (r) => r.wellbeing],
    ['harmony', (r) => r.harmony],
    ['materials', (r) => r.materials],
    ['food', (r) => r.food],
    ['clutter', (r) => r.clutter],
    ...r4('idle_era', (r, i) => r.idleByEra[i] ?? 0),
    ['idle_seasons', (r) => sum(r.idleByEra)],
    ...SEASON_NAMES.map(
      (s, i) => [`blackouts_${s}`, (r: RunRecord) => r.blackoutsBySeason[i] ?? 0] as const,
    ),
    ['blackout_seasons', (r) => sum(r.blackoutsBySeason)],
    ['shortfall', (r) => r.shortfall],
    ['unfed_citizen_seasons', (r) => r.unfedCitizenSeasons],
    ['food_made_after_y1', (r) => r.foodMadeAfterY1],
    ['food_eaten_after_y1', (r) => r.foodEatenAfterY1],
    ['food_rotted', (r) => r.foodRotted],
    ['storage_full_seasons', (r) => r.storageFullSeasons],
    ['scraps_from_citizens', (r) => r.scrapsFromCitizens],
    ['scraps_from_rot', (r) => r.scrapsFromRot],
    ['clutter_from_scraps', (r) => r.clutterFromScraps],
    ['clutter_recycled', (r) => r.clutterRecycled],
    ...sources.map((s) => [`energy_${s}`, (r: RunRecord) => r.energyBySource[s] ?? 0] as const),
    ['heat_pumped', (r) => r.heatPumped],
    ['heat_free', (r) => r.heatFree],
    ['wellbeing_lost_hunger', (r) => r.wellbeingLost.hunger],
    ['wellbeing_lost_unpowered', (r) => r.wellbeingLost.unpowered],
    ['wellbeing_lost_clutter', (r) => r.wellbeingLost.clutter],
    ['collapse_cause', (r) => r.collapseCause],
    ['empty_draft_seasons', (r) => r.emptyDraftSeasons],
    ['picks', (r) => r.picks.join(';')],
    [
      'built',
      (r) =>
        Object.entries(r.built)
          .map(([k, v]) => `${k}:${v}`)
          .join(';'),
    ],
  ];
  const lines = [columns.map(([name]) => name).join(',')];
  for (const r of records) lines.push(columns.map(([, get]) => csvCell(get(r))).join(','));
  return lines.join('\n') + '\n';
}

function r4(prefix: string, get: (r: RunRecord, i: number) => number): Column[] {
  return [0, 1, 2, 3].map((i) => [`${prefix}${i + 1}`, (r: RunRecord) => get(r, i)] as const);
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// ---------------------------------------------------------------- statistics

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length;
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const fixed = (x: number, digits = 1) => x.toFixed(digits);

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    out.set(k, [...(out.get(k) ?? []), item]);
  }
  return out;
}

function table(header: string[], rows: (string | number)[][]): string {
  const line = (cells: (string | number)[]) => `| ${cells.join(' | ')} |`;
  return [line(header), line(header.map(() => '---')), ...rows.map(line)].join('\n');
}

// ---------------------------------------------------------------- report

export interface ReportMeta {
  command: string;
  contentId: string;
  runsPerBot: number;
  bots: { name: string; description: string }[];
}

export function toReport(records: RunRecord[], meta: ReportMeta): string {
  const byBot = groupBy(records, (r) => r.bot);
  const bots = meta.bots.filter((b) => byBot.has(b.name));
  const out: string[] = [];
  // Blocks are separated by blank lines so every table renders as a table.
  const push = (...blocks: string[]) => out.push(blocks.filter((b) => b !== '').join('\n\n'), '');

  push(
    '# Sunroot balance report',
    `${records.length} runs of ${meta.contentId}: ${meta.runsPerBot} seeds for each of ${bots.length} bots. ` +
      'Every bot plays the same seeds. Scores use the provisional formula in the content file ' +
      '(the real one is an open question for Milestone 7).',
    `Reproduce with \`${meta.command}\`. Every run is also a row in \`runs.csv\`.`,
  );

  push(
    '## Bots',
    table(
      ['Bot', 'Strategy'],
      bots.map((b) => [b.name, b.description]),
    ),
  );

  // Summary.
  push(
    '## Summary',
    table(
      [
        'Bot',
        'Completed',
        'Seasons survived (median)',
        'Score p10',
        'Score median',
        'Score p90',
        'Peak citizens (median)',
        'Blackout seasons (mean)',
        'Idle seasons (mean)',
      ],
      bots.map((b) => {
        const rs = byBot.get(b.name)!;
        const scores = rs.map((r) => r.score);
        return [
          b.name,
          pct(rs.filter((r) => r.status === 'complete').length / rs.length),
          quantile(
            rs.map((r) => r.seasons),
            0.5,
          ),
          quantile(scores, 0.1),
          quantile(scores, 0.5),
          quantile(scores, 0.9),
          quantile(
            rs.map((r) => r.peakCitizens),
            0.5,
          ),
          fixed(mean(rs.map((r) => sum(r.blackoutsBySeason)))),
          fixed(mean(rs.map((r) => sum(r.idleByEra)))),
        ];
      }),
    ),
  );

  // Score spread.
  const maxScore = Math.max(...records.map((r) => r.score), 1);
  const binSize = Math.max(10, Math.ceil(maxScore / 10 / 10) * 10);
  const bins = Math.ceil((maxScore + 1) / binSize);
  const spreadRows = bots.map((b) => {
    const counts = new Array<number>(bins).fill(0);
    for (const r of byBot.get(b.name)!) counts[Math.floor(r.score / binSize)]! += 1;
    return [b.name, ...counts];
  });
  push(
    '## Score spread',
    'Runs per score band.',
    table(
      ['Bot', ...Array.from({ length: bins }, (_, i) => `${i * binSize}–${(i + 1) * binSize - 1}`)],
      spreadRows,
    ),
  );

  // How runs end.
  const causes = ['hunger', 'unpowered', 'clutter'];
  push(
    '## How runs end',
    'A collapsed run is blamed on its biggest wellbeing drain over its last 4 seasons.',
    table(
      [
        'Bot',
        'Completed',
        ...causes.map((c) => `Collapsed: ${c}`),
        'Wellbeing lost per run (hunger / unpowered / clutter)',
      ],
      bots.map((b) => {
        const rs = byBot.get(b.name)!;
        return [
          b.name,
          rs.filter((r) => r.status === 'complete').length,
          ...causes.map((c) => rs.filter((r) => r.collapseCause === c).length),
          (['hunger', 'unpowered', 'clutter'] as const)
            .map((k) => fixed(mean(rs.map((r) => r.wellbeingLost[k])), 0))
            .join(' / '),
        ];
      }),
    ),
  );

  // Cards.
  const cardStats = cardTable(
    records,
    bots.map((b) => b.name),
  );
  const poolEmpty = mean(
    records.filter((r) => r.seasons >= 48).map((r) => 48 - r.emptyDraftSeasons),
  );
  push(
    '## Cards',
    `Pick rate is how often a card was taken when it was on offer. Early lift compares runs that picked the ` +
      `card in the first ${EARLY / 4} years with runs that did not, among runs that lasted that long, ` +
      "averaged over bots so a bot's own preferences don't skew it. Random-bot picks are random, so its " +
      'early lift is the least biased measure of a card on its own. Lift needs at least 3 runs on each side.',
    table(
      [
        'Card',
        'Offered',
        'Pick rate',
        'Mean season picked',
        'Early lift (all bots)',
        'Early lift (random bot)',
      ],
      cardStats.map((c) => [
        c.card,
        c.offered,
        pct(c.pickRate),
        fixed(c.meanPickTurn + 1),
        c.lift === null ? '–' : signed(c.lift),
        c.randomLift === null ? '–' : signed(c.randomLift),
      ]),
    ),
    '',
    `In runs that reached the end, the draft had cards to offer for ${fixed(poolEmpty)} of 48 seasons on average: ` +
      'after that every blueprint is unlocked and there is nothing left to pick.',
  );

  // Idle seasons.
  push(
    '## Idle seasons',
    'Seasons in which the bot built or changed nothing, per run, by era.',
    table(
      ['Bot', 'Settle', 'Mend', 'Flourish', 'Bloom'],
      bots.map((b) => {
        const rs = byBot.get(b.name)!;
        return [
          b.name,
          ...[0, 1, 2, 3].map((i) => fixed(mean(rs.map((r) => r.idleByEra[i] ?? 0)))),
        ];
      }),
    ),
  );

  // Blackouts.
  push(
    '## Blackouts',
    'Share of runs with at least one blackout in that season of the year, and mean blackout seasons per run.',
    table(
      ['Bot', ...SEASON_NAMES, 'Mean per run'],
      bots.map((b) => {
        const rs = byBot.get(b.name)!;
        return [
          b.name,
          ...SEASON_NAMES.map((_, i) =>
            pct(rs.filter((r) => (r.blackoutsBySeason[i] ?? 0) > 0).length / rs.length),
          ),
          fixed(mean(rs.map((r) => sum(r.blackoutsBySeason)))),
        ];
      }),
    ),
  );

  // Energy mix.
  const mix = (rs: RunRecord[]) => {
    const totals: Record<string, number> = {};
    for (const r of rs) {
      for (const [k, v] of Object.entries(r.energyBySource)) totals[k] = (totals[k] ?? 0) + v;
    }
    return totals;
  };
  const sources = [...new Set(records.flatMap((r) => Object.keys(r.energyBySource)))].sort();
  const topQuartile = [...records]
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.ceil(records.length / 4));
  const mixRow = (label: string, rs: RunRecord[]) => {
    const totals = mix(rs);
    const all = sum(Object.values(totals)) || 1;
    return [label, ...sources.map((s) => pct((totals[s] ?? 0) / all))];
  };
  push(
    '## Energy mix',
    'Share of all energy generated, by source.',
    table(
      ['Runs', ...sources],
      [
        ...bots.map((b) => mixRow(b.name, byBot.get(b.name)!)),
        mixRow('top 25% by score', topQuartile),
      ],
    ),
  );

  push(
    '## Balance questions',
    ...balanceQuestions(
      records,
      bots.map((b) => b.name),
      byBot,
      cardStats,
      topQuartile,
    ),
  );
  return out.join('\n');
}

function signed(x: number): string {
  return `${x >= 0 ? '+' : ''}${x.toFixed(1)}`;
}

/** Cards picked by this season count as early picks. */
const EARLY = 8;

interface CardStat {
  card: string;
  offered: number;
  pickRate: number;
  meanPickTurn: number;
  lift: number | null;
  randomLift: number | null;
}

function cardTable(records: RunRecord[], bots: string[]): CardStat[] {
  const cards = [...new Set(records.flatMap((r) => Object.keys(r.offered)))];
  const earlyLift = (rs: RunRecord[], card: string): number | null => {
    const long = rs.filter((r) => r.seasons >= EARLY);
    const picked = (r: RunRecord) => (r.pickTurns[card] ?? Infinity) < EARLY;
    const withCard = long.filter(picked).map((r) => r.score);
    const without = long.filter((r) => !picked(r)).map((r) => r.score);
    if (withCard.length < 3 || without.length < 3) return null;
    return mean(withCard) - mean(without);
  };
  return cards
    .map((card) => {
      const lifts = bots
        .map((b) =>
          earlyLift(
            records.filter((r) => r.bot === b),
            card,
          ),
        )
        .filter((x): x is number => x !== null);
      const offered = sum(records.map((r) => r.offered[card] ?? 0));
      const turns = records.map((r) => r.pickTurns[card]).filter((t) => t !== undefined);
      return {
        card,
        offered,
        pickRate: offered === 0 ? 0 : turns.length / offered,
        meanPickTurn: mean(turns),
        lift: lifts.length === 0 ? null : mean(lifts),
        randomLift: earlyLift(
          records.filter((r) => r.bot === 'random'),
          card,
        ),
      };
    })
    .sort((a, b) => b.pickRate - a.pickRate);
}

function balanceQuestions(
  records: RunRecord[],
  bots: string[],
  byBot: Map<string, RunRecord[]>,
  cards: CardStat[],
  topQuartile: RunRecord[],
): string[] {
  const out: string[] = [];
  const smart = records.filter((r) => r.bot !== 'random');

  // Food.
  const made = sum(smart.map((r) => r.foodMadeAfterY1));
  const eaten = sum(smart.map((r) => r.foodEatenAfterY1));
  const rotted = sum(smart.map((r) => r.foodRotted));
  const seasonsAfterY1 = sum(smart.map((r) => Math.max(0, r.seasons - 4)));
  const fullShare =
    sum(smart.map((r) => r.storageFullSeasons)) / Math.max(1, sum(smart.map((r) => r.seasons)));
  const ratio = eaten === 0 ? 0 : made / eaten;
  out.push(
    '### Is food too easy after Year 1? Do farms outpace population?',
    table(
      [
        'Bot',
        'Food made / eaten after Year 1',
        'Share of food made that rots',
        'Seasons ending with storage full',
      ],
      bots.map((b) => {
        const rs = byBot.get(b)!;
        const m = sum(rs.map((r) => r.foodMadeAfterY1));
        const e = sum(rs.map((r) => r.foodEatenAfterY1));
        return [
          b,
          e === 0 ? '–' : fixed(m / e, 2),
          m === 0 ? '–' : pct(sum(rs.map((r) => r.foodRotted)) / m),
          pct(
            sum(rs.map((r) => r.storageFullSeasons)) / Math.max(1, sum(rs.map((r) => r.seasons))),
          ),
        ];
      }),
    ),
    '',
    seasonsAfterY1 === 0
      ? 'Not enough seasons after Year 1 to say.'
      : ratio > 1.3
        ? `**Yes.** The non-random bots make ${fixed(ratio, 2)}× the food they eat after Year 1; ` +
          `${pct(rotted / Math.max(1, made))} of it rots, and ${pct(fullShare)} of seasons end with storage full. ` +
          (sum(smart.map((r) => r.scrapsFromRot)) > 0
            ? 'Rotting food becomes scraps, then clutter, so the surplus is not just wasted: it costs wellbeing and Harmony.'
            : 'Rotting food becomes biomass, so the surplus is wasted but does no harm.')
        : `**No.** The non-random bots make ${fixed(ratio, 2)}× the food they eat after Year 1.`,
    '',
  );

  // Energy.
  const topMix: Record<string, number> = {};
  for (const r of topQuartile) {
    for (const [k, v] of Object.entries(r.energyBySource)) {
      if (k !== 'foundersCamp') topMix[k] = (topMix[k] ?? 0) + v;
    }
  }
  const built = sum(Object.values(topMix)) || 1;
  const [leader, leaderAmount] = Object.entries(topMix).sort((a, b) => b[1] - a[1])[0] ?? [
    'none',
    0,
  ];
  out.push(
    '### Does any single energy source dominate?',
    `In the top 25% of runs by score, ${leader} makes ${pct(leaderAmount / built)} of the energy from built sources. ` +
      (leaderAmount / built > 0.5
        ? '**It dominates:** more than half of built energy comes from one source.'
        : 'No single built source makes more than half.') +
      ' The mix partly reflects what each bot prefers to build, so compare it with the per-bot table above.' +
      ' Tunings are not in the game yet (Milestone 6), so "once tunings stack" cannot be answered until then.',
    '',
  );

  // Dominant strategy.
  const medians = bots
    .map((b) => ({
      bot: b,
      median: quantile(
        byBot.get(b)!.map((r) => r.score),
        0.5,
      ),
    }))
    .sort((a, b) => b.median - a.median);
  const topCards = [...cards].filter((c) => c.lift !== null).sort((a, b) => b.lift! - a.lift!);
  out.push(
    '### Is there one dominant strategy?',
    `Median score by bot: ${medians.map((m) => `${m.bot} ${m.median}`).join(', ')}. ` +
      `The cards with the biggest early lift: ${topCards
        .slice(0, 3)
        .map((c) => `${c.card} (${signed(c.lift!)})`)
        .join(', ')}.` +
      (medians.length > 1 && medians[0]!.median > 1.25 * medians[1]!.median
        ? ` **${medians[0]!.bot} leads by more than 25%.**`
        : ''),
    '',
  );

  // Idle middle.
  const idle = (era: number) => mean(smart.map((r) => r.idleByEra[era] ?? 0));
  out.push(
    '### Do runs feel long in the middle?',
    `Non-random bots have ${fixed(idle(0))} idle seasons in Settle, ${fixed(idle(1))} in Mend, ` +
      `${fixed(idle(2))} in Flourish and ${fixed(idle(3))} in Bloom (12 seasons per era; collapsed runs count fewer seasons). ` +
      (idle(1) + idle(2) > 2 * (idle(0) + 1)
        ? '**The middle eras are quieter than the first.**'
        : 'The middle eras are not much quieter than the first.'),
    '',
  );

  // Clutter.
  const lost = (k: 'hunger' | 'unpowered' | 'clutter') =>
    mean(smart.map((r) => r.wellbeingLost[k]));
  const collapsedByClutter = smart.filter((r) => r.collapseCause === 'clutter').length;
  out.push(
    '### What costs wellbeing? (the clutter spiral, DECISIONS.md Q1)',
    `Per non-random run, scraps came ${fixed(mean(smart.map((r) => r.scrapsFromCitizens)), 0)} from citizens and ` +
      `${fixed(mean(smart.map((r) => r.scrapsFromRot)), 0)} from rotting food; ` +
      `${fixed(mean(smart.map((r) => r.clutterFromScraps)), 0)} became clutter. ` +
      `Wellbeing lost: ${fixed(lost('hunger'), 0)} to hunger, ` +
      `${fixed(lost('unpowered'), 0)} to unpowered homes, ${fixed(lost('clutter'), 0)} to clutter. ` +
      `${collapsedByClutter} of ${smart.length} non-random runs collapsed from clutter.`,
    '',
  );
  return out;
}
