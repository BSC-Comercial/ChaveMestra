import type { VaultFile } from './crypto';

/**
 * Cópia local do arquivo criptografado (IndexedDB do navegador).
 * Funciona como cache offline; a cópia principal fica no Google Drive quando conectado.
 */

const DB_NAME = 'chavemestra';
const STORE = 'vault';

export interface SyncMeta {
  /** Versão do arquivo no Google Drive que esta cópia local conhece. */
  etag: string | null;
  /** Há alterações locais ainda não enviadas ao Google Drive. */
  dirty: boolean;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(req ? req.result : (undefined as T));
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const localVault = {
  async load(): Promise<VaultFile | null> {
    return (await run<VaultFile | undefined>('readonly', (s) => s.get('current'))) ?? null;
  },
  async save(file: VaultFile) {
    // Mantém a versão anterior como rede de segurança contra gravação corrompida.
    await run('readwrite', (s) => {
      const prev = s.get('current');
      prev.onsuccess = () => {
        if (prev.result) s.put(prev.result, 'previous');
        s.put(file, 'current');
      };
    });
  },
  async loadMeta(): Promise<SyncMeta> {
    const m = await run<SyncMeta | undefined>('readonly', (s) => s.get('sync'));
    return m ?? { etag: null, dirty: true };
  },
  async saveMeta(meta: SyncMeta) {
    await run('readwrite', (s) => s.put(meta, 'sync'));
  },
  async clear() {
    await run('readwrite', (s) => s.clear());
  },
};
