/** Runs many games, in parallel worker threads when asked, in a stable order. */
import { Worker } from 'node:worker_threads';
import { loadContent, type Content } from '../sim';
import willowReach from '../content/willow-reach.json';
import { BOTS } from './bots';
import { playRun, type RunRecord } from './runner';

export interface Job {
  bot: string;
  seed: string;
}

export interface SimulateOptions {
  runsPerBot: number;
  bots: string[];
  seedPrefix: string;
  guided: boolean;
  jobs: number;
  onProgress?: (done: number, total: number) => void;
}

export function loadWillowReach(): Content {
  return loadContent(willowReach);
}

export function planJobs(
  options: Pick<SimulateOptions, 'runsPerBot' | 'bots' | 'seedPrefix'>,
): Job[] {
  const jobs: Job[] = [];
  for (let i = 0; i < options.runsPerBot; i++) {
    for (const bot of options.bots) jobs.push({ bot, seed: `${options.seedPrefix}-${i}` });
  }
  return jobs;
}

export function runJobs(content: Content, jobs: Job[], guided: boolean): RunRecord[] {
  return jobs.map((j) => playRun(content, BOTS[j.bot]!, j.seed, { guided }));
}

/** Plays every job and returns records ordered as the jobs were planned. */
export async function simulate(options: SimulateOptions): Promise<RunRecord[]> {
  for (const bot of options.bots) if (!BOTS[bot]) throw new Error(`unknown bot ${bot}`);
  const jobs = planJobs(options);
  const content = loadWillowReach();
  if (options.jobs <= 1 || jobs.length < 8) {
    const out: RunRecord[] = [];
    jobs.forEach((j, i) => {
      out.push(playRun(content, BOTS[j.bot]!, j.seed, { guided: options.guided }));
      options.onProgress?.(i + 1, jobs.length);
    });
    return out;
  }

  // Deal jobs out in small batches so workers stay busy; reassemble in plan order.
  const results: RunRecord[] = new Array(jobs.length);
  const batch = 10;
  let next = 0;
  let done = 0;
  const workerCount = Math.min(options.jobs, Math.ceil(jobs.length / batch));
  await Promise.all(
    Array.from(
      { length: workerCount },
      () =>
        new Promise<void>((resolve, reject) => {
          const worker = new Worker(new URL('./worker-entry.mjs', import.meta.url));
          const send = () => {
            if (next >= jobs.length) {
              void worker.terminate().then(() => resolve());
              return;
            }
            const start = next;
            next = Math.min(jobs.length, next + batch);
            worker.postMessage({ start, jobs: jobs.slice(start, next), guided: options.guided });
          };
          worker.on('message', (msg: { start: number; records: RunRecord[] }) => {
            msg.records.forEach((r, i) => (results[msg.start + i] = r));
            done += msg.records.length;
            options.onProgress?.(done, jobs.length);
            send();
          });
          worker.on('error', reject);
          send();
        }),
    ),
  );
  return results;
}
