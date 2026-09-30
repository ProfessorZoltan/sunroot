import { parentPort } from 'node:worker_threads';
import { loadWillowReach, runJobs, type Job } from './simulate';

const content = loadWillowReach();
parentPort!.on('message', (msg: { start: number; jobs: Job[]; guided: boolean }) => {
  parentPort!.postMessage({ start: msg.start, records: runJobs(content, msg.jobs, msg.guided) });
});
