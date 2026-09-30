/**
 * The balance simulator (Milestone 2).
 *
 *   npm run balance                      # 1000 seeds x every bot, into balance-out/
 *   npm run balance -- --runs 200 --bots greedyFood,balanced --out my-dir --jobs 4
 *
 * Writes runs.csv (one row per run) and report.md (the summary and the build
 * plan's balance questions).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { BOTS } from './bots';
import { toCsv, toReport } from './report';
import { simulate } from './simulate';

export interface CliOptions {
  runsPerBot: number;
  bots: string[];
  out: string;
  seedPrefix: string;
  jobs: number;
  guided: boolean;
}

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    runsPerBot: 1000,
    bots: Object.keys(BOTS),
    out: 'balance-out',
    seedPrefix: 'balance',
    jobs: availableParallelism(),
    guided: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]!;
    const value = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${flag} needs a value`);
      return v;
    };
    switch (flag) {
      case '--runs':
        options.runsPerBot = positiveInt(flag, value());
        break;
      case '--bots':
        options.bots = value().split(',').filter(Boolean);
        for (const b of options.bots) {
          if (!BOTS[b])
            throw new Error(`unknown bot ${b}; choose from ${Object.keys(BOTS).join(', ')}`);
        }
        break;
      case '--out':
        options.out = value();
        break;
      case '--seed':
        options.seedPrefix = value();
        break;
      case '--jobs':
        options.jobs = positiveInt(flag, value());
        break;
      case '--guided':
        options.guided = true;
        break;
      case '--help':
        throw new Error(
          'usage: npm run balance -- [--runs N] [--bots a,b] [--out dir] [--seed prefix] [--jobs N] [--guided]',
        );
      default:
        throw new Error(`unknown option ${flag} (try --help)`);
    }
  }
  return options;
}

function positiveInt(flag: string, text: string): number {
  const n = Number(text);
  if (!Number.isInteger(n) || n < 1) throw new Error(`${flag} needs a positive whole number`);
  return n;
}

export async function main(argv: string[], log: (line: string) => void = console.log) {
  const options = parseArgs(argv);
  const total = options.runsPerBot * options.bots.length;
  log(
    `Playing ${total} runs (${options.runsPerBot} seeds x ${options.bots.join(', ')}) on ${options.jobs} threads...`,
  );
  let lastShown = 0;
  const records = await simulate({
    ...options,
    onProgress(done, all) {
      const tenth = Math.floor((done / all) * 10);
      if (tenth > lastShown) {
        lastShown = tenth;
        log(`  ${done} / ${all}`);
      }
    },
  });
  mkdirSync(options.out, { recursive: true });
  const csvPath = join(options.out, 'runs.csv');
  const reportPath = join(options.out, 'report.md');
  writeFileSync(csvPath, toCsv(records));
  const command = [
    'npm run balance --',
    `--runs ${options.runsPerBot}`,
    `--bots ${options.bots.join(',')}`,
    `--seed ${options.seedPrefix}`,
    ...(options.guided ? ['--guided'] : []),
  ].join(' ');
  writeFileSync(
    reportPath,
    toReport(records, {
      command,
      contentId: 'willowReach',
      runsPerBot: options.runsPerBot,
      bots: options.bots.map((b) => ({ name: b, description: BOTS[b]!.description })),
    }),
  );
  log(`Wrote ${csvPath} and ${reportPath}`);
  return { records, csvPath, reportPath };
}

const invokedDirectly =
  process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!);
if (invokedDirectly) {
  main(process.argv.slice(2)).catch((error: Error) => {
    console.error(error.message);
    process.exit(1);
  });
}
