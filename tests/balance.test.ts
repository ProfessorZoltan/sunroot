import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BOTS } from '../src/balance/bots';
import { main, parseArgs } from '../src/balance/cli';
import { toCsv, toReport } from '../src/balance/report';
import { playRun } from '../src/balance/runner';
import { simulate } from '../src/balance/simulate';
import { content } from './helpers';

describe('bots', () => {
  it.each(Object.keys(BOTS))('%s plays a whole run, the same way every time', (name) => {
    const a = playRun(content, BOTS[name]!, 'bot-test');
    const b = playRun(content, BOTS[name]!, 'bot-test');
    expect(a).toEqual(b);
    expect(a.seasons).toBeGreaterThan(0);
    expect(a.seasons).toBeLessThanOrEqual(48);
    expect(a.picks.length).toBeGreaterThan(0);
  });

  it.each(['greedyFood', 'greedyEnergy', 'balanced'])('%s gets through Year 1', (name) => {
    for (const seed of ['y1-a', 'y1-b', 'y1-c']) {
      expect(playRun(content, BOTS[name]!, seed).seasons).toBeGreaterThanOrEqual(4);
    }
  });
});

describe('report', () => {
  const records = Object.values(BOTS).flatMap((bot) =>
    ['r-1', 'r-2', 'r-3'].map((seed) => playRun(content, bot, seed)),
  );

  it('writes one CSV row per run, every row as wide as the header', () => {
    const rows = toCsv(records).trim().split('\n');
    expect(rows).toHaveLength(records.length + 1);
    const width = rows[0]!.split(',').length;
    for (const row of rows.slice(1)) expect(row.split(',')).toHaveLength(width);
    expect(rows[0]).toContain('score');
    expect(rows[0]).toContain('idle_seasons');
    expect(rows[0]).toContain('blackout_seasons');
  });

  it('covers the numbers the build plan asks for, and its balance questions', () => {
    const report = toReport(records, {
      command: 'npm run balance',
      contentId: 'willowReach',
      runsPerBot: 3,
      bots: Object.values(BOTS),
    });
    for (const heading of [
      '## Summary',
      '## Score spread',
      '## Run end',
      '## Cards',
      '## Idle seasons',
      '## Blackouts',
      '## Energy mix',
      '### Is food too easy after Year 1?',
      '### Does any single energy source dominate?',
      '### Is there one dominant strategy?',
      '### Do runs feel long in the middle?',
    ]) {
      expect(report).toContain(heading);
    }
  });
});

describe('the command', () => {
  it('parses options and rejects bad ones', () => {
    expect(parseArgs([]).runsPerBot).toBe(1000);
    expect(parseArgs(['--runs', '5', '--bots', 'random,balanced'])).toMatchObject({
      runsPerBot: 5,
      bots: ['random', 'balanced'],
    });
    expect(() => parseArgs(['--runs', '0'])).toThrow(/positive whole number/);
    expect(() => parseArgs(['--bots', 'wizard'])).toThrow(/unknown bot wizard/);
    expect(() => parseArgs(['--colour'])).toThrow(/unknown option/);
  });

  it('gives the same results on worker threads as on one thread', async () => {
    const options = { runsPerBot: 3, bots: Object.keys(BOTS), seedPrefix: 'par', guided: false };
    const serial = await simulate({ ...options, jobs: 1 });
    const parallel = await simulate({ ...options, jobs: 2 });
    expect(parallel).toEqual(serial);
    // About 25 s alone; with the whole suite running beside it, more.
  }, 90_000);

  it('writes runs.csv and report.md with one command', async () => {
    const out = mkdtempSync(join(tmpdir(), 'sunroot-balance-'));
    const lines: string[] = [];
    await main(['--runs', '2', '--jobs', '1', '--out', out], (l) => lines.push(l));
    expect(readFileSync(join(out, 'runs.csv'), 'utf8').trim().split('\n')).toHaveLength(
      2 * Object.keys(BOTS).length + 1,
    );
    expect(readFileSync(join(out, 'report.md'), 'utf8')).toContain('# Sunroot balance report');
    expect(lines.at(-1)).toMatch(/^Wrote /);
    // Two whole runs per bot: like the test above, more than the default 5 s.
  }, 30_000);
});
