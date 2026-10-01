/**
 * Where the current run is saved: IndexedDB in the browser (the design's
 * choice: it survives reloads and holds large saves), or memory in tests.
 * The save itself is the simulation's versioned save file (src/sim/save.ts).
 */
export interface SaveSlot {
  load(): Promise<unknown>;
  save(data: unknown): Promise<void>;
  clear(): Promise<void>;
}

const DB = 'sunroot';
const STORE = 'saves';
const KEY = 'current';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB failed to open'));
  });
}

function request<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = run(tx.objectStore(STORE));
        tx.oncomplete = () => {
          db.close();
          resolve(req.result);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error('IndexedDB request failed'));
        };
      }),
  );
}

/** The browser's save slot. Every call fails soft: a broken store never breaks the game. */
export function indexedDbSlot(): SaveSlot {
  const available = typeof indexedDB !== 'undefined';
  return {
    load: () =>
      available
        ? request('readonly', (s) => s.get(KEY)).catch(() => undefined)
        : Promise.resolve(undefined),
    save: (data) =>
      available
        ? request('readwrite', (s) => s.put(data, KEY)).then(
            () => undefined,
            () => undefined,
          )
        : Promise.resolve(),
    clear: () =>
      available
        ? request('readwrite', (s) => s.delete(KEY)).then(
            () => undefined,
            () => undefined,
          )
        : Promise.resolve(),
  };
}

export function memorySlot(initial?: unknown): SaveSlot {
  let data = initial;
  return {
    load: () => Promise.resolve(data),
    save: (d) => {
      data = structuredClone(d);
      return Promise.resolve();
    },
    clear: () => {
      data = undefined;
      return Promise.resolve();
    },
  };
}

/** Saves after changes settle, at most every `delay` ms. */
export function debounced(save: () => void, delay = 400): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      save();
    }, delay);
  };
}
