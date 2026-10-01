import { parentPort } from 'node:worker_threads';
import { loadWillowReach, runJobs, type Job, type PlayOptions } from './simulate';

const content = loadWillowReach();
parentPort!.on('message', (msg: { start: number; jobs: Job[]; play: PlayOptions }) => {
  parentPort!.postMessage({ start: msg.start, records: runJobs(content, msg.jobs, msg.play) });
});
