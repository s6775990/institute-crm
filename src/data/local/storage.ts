// Storage primitives for the demo data service, injectable so tests can run in Node.

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface BlobStore {
  put(id: string, blob: Blob): Promise<void>;
  get(id: string): Promise<Blob | null>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

export class MemoryKeyValueStore implements KeyValueStore {
  private readonly data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

export class MemoryBlobStore implements BlobStore {
  private readonly data = new Map<string, Blob>();
  async put(id: string, blob: Blob) {
    this.data.set(id, blob);
  }
  async get(id: string) {
    return this.data.get(id) ?? null;
  }
  async delete(id: string) {
    this.data.delete(id);
  }
  async clear() {
    this.data.clear();
  }
}

/** Attached files are kept in IndexedDB; browser key-value storage is too small for them. */
export class IndexedDbBlobStore implements BlobStore {
  private readonly dbName: string;
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(dbName: string) {
    this.dbName = dbName;
  }

  private open(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(this.dbName, 1);
        req.onupgradeneeded = () => req.result.createObjectStore('files');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this.dbPromise;
  }

  private async run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction('files', mode);
      const req = op(tx.objectStore('files'));
      tx.oncomplete = () => resolve(req.result as T);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async put(id: string, blob: Blob) {
    await this.run('readwrite', (s) => s.put(blob, id));
  }
  async get(id: string) {
    return (await this.run<Blob | undefined>('readonly', (s) => s.get(id))) ?? null;
  }
  async delete(id: string) {
    await this.run('readwrite', (s) => s.delete(id));
  }
  async clear() {
    await this.run('readwrite', (s) => s.clear());
  }
}
