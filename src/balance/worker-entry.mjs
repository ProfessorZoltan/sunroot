// Worker threads don't inherit tsx's loader, so register it here, then load the TypeScript worker.
import { register } from 'tsx/esm/api';

register();
await import('./worker.ts');
