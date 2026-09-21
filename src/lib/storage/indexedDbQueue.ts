/**
 * Native IndexedDB Storage Engine for VCTM ERP
 * Zero-dependency, lightweight, typed, and resilient browser persistence.
 * Safe for SSR / Node environments with an in-memory fallback.
 */

export interface StoredMutation {
  mutation_id: string;
  operation_type: string;
  entity_type: string;
  entity_id: string;
  payload: any;
  created_at: string;
  retry_count: number;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED_RETRYABLE' | 'FAILED_PERMANENT';
  idempotency_key: string;
  error_message?: string;
  last_attempt_at?: string;
}

export interface StoredCacheEntry {
  cache_key: string;
  data: any;
  timestamp: number;
  ttl_ms: number;
}

export interface StoredOutboxMessage {
  client_message_id: string;
  group_id?: string;
  conversation_id?: string;
  payload: any;
  created_at: string;
  status: 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED';
  retry_count: number;
  error_message?: string;
}

const DB_NAME = 'VCTM_ERP_OFFLINE_DB';
const DB_VERSION = 1;

const STORES = {
  MUTATIONS: 'durable_mutations',
  CACHE: 'query_cache',
  OUTBOX: 'message_outbox',
} as const;

// Memory fallback for Node.js / tests / private browsing where IndexedDB is unavailable
class MemoryDbFallback {
  private mutations = new Map<string, StoredMutation>();
  private cache = new Map<string, StoredCacheEntry>();
  private outbox = new Map<string, StoredOutboxMessage>();

  async putMutation(item: StoredMutation): Promise<void> {
    this.mutations.set(item.mutation_id, item);
  }
  async getMutation(id: string): Promise<StoredMutation | undefined> {
    return this.mutations.get(id);
  }
  async getMutationByIdempotencyKey(key: string): Promise<StoredMutation | undefined> {
    for (const m of this.mutations.values()) {
      if (m.idempotency_key === key) return m;
    }
    return undefined;
  }
  async getAllMutations(): Promise<StoredMutation[]> {
    return Array.from(this.mutations.values());
  }
  async deleteMutation(id: string): Promise<void> {
    this.mutations.delete(id);
  }

  async putCache(item: StoredCacheEntry): Promise<void> {
    this.cache.set(item.cache_key, item);
  }
  async getCache(key: string): Promise<StoredCacheEntry | undefined> {
    return this.cache.get(key);
  }
  async getAllCache(): Promise<StoredCacheEntry[]> {
    return Array.from(this.cache.values());
  }
  async deleteCache(key: string): Promise<void> {
    this.cache.delete(key);
  }
  async clearCache(): Promise<void> {
    this.cache.clear();
  }

  async putOutbox(item: StoredOutboxMessage): Promise<void> {
    this.outbox.set(item.client_message_id, item);
  }
  async getOutbox(id: string): Promise<StoredOutboxMessage | undefined> {
    return this.outbox.get(id);
  }
  async getAllOutbox(): Promise<StoredOutboxMessage[]> {
    return Array.from(this.outbox.values());
  }
  async deleteOutbox(id: string): Promise<void> {
    this.outbox.delete(id);
  }
}

class IndexedDbQueueStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private fallback = new MemoryDbFallback();
  private useFallback = false;

  constructor() {
    if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
      this.useFallback = true;
    }
  }

  private async getDb(): Promise<IDBDatabase | null> {
    if (this.useFallback) return null;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          // 1. Durable Mutations Store
          if (!db.objectStoreNames.contains(STORES.MUTATIONS)) {
            const mutStore = db.createObjectStore(STORES.MUTATIONS, { keyPath: 'mutation_id' });
            mutStore.createIndex('by_status', 'status', { unique: false });
            mutStore.createIndex('by_idempotency_key', 'idempotency_key', { unique: true });
            mutStore.createIndex('by_created_at', 'created_at', { unique: false });
            mutStore.createIndex('by_operation', 'operation_type', { unique: false });
          }

          // 2. Query Cache Store
          if (!db.objectStoreNames.contains(STORES.CACHE)) {
            const cacheStore = db.createObjectStore(STORES.CACHE, { keyPath: 'cache_key' });
            cacheStore.createIndex('by_timestamp', 'timestamp', { unique: false });
          }

          // 3. Message Outbox Store
          if (!db.objectStoreNames.contains(STORES.OUTBOX)) {
            const outboxStore = db.createObjectStore(STORES.OUTBOX, { keyPath: 'client_message_id' });
            outboxStore.createIndex('by_group_id', 'group_id', { unique: false });
            outboxStore.createIndex('by_conversation_id', 'conversation_id', { unique: false });
            outboxStore.createIndex('by_status', 'status', { unique: false });
          }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          console.warn('IndexedDB failed to open, switching to in-memory fallback:', req.error);
          this.useFallback = true;
          resolve(null as any);
        };
      } catch (err) {
        console.warn('IndexedDB exception, switching to in-memory fallback:', err);
        this.useFallback = true;
        resolve(null as any);
      }
    });

    return this.dbPromise;
  }

  // --- MUTATIONS API ---
  async putMutation(item: StoredMutation): Promise<void> {
    const db = await this.getDb();
    if (!db || this.useFallback) return this.fallback.putMutation(item);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MUTATIONS, 'readwrite');
      const store = tx.objectStore(STORES.MUTATIONS);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getMutation(id: string): Promise<StoredMutation | undefined> {
    const db = await this.getDb();
    if (!db || this.useFallback) return this.fallback.getMutation(id);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MUTATIONS, 'readonly');
      const store = tx.objectStore(STORES.MUTATIONS);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getMutationByIdempotencyKey(key: string): Promise<StoredMutation | undefined> {
    const db = await this.getDb();
    if (!db || this.useFallback) return this.fallback.getMutationByIdempotencyKey(key);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MUTATIONS, 'readonly');
      const store = tx.objectStore(STORES.MUTATIONS);
      const index = store.index('by_idempotency_key');
      const req = index.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllMutations(): Promise<StoredMutation[]> {
    const db = await this.getDb();
    if (!db || this.useFallback) return this.fallback.getAllMutations();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MUTATIONS, 'readonly');
      const store = tx.objectStore(STORES.MUTATIONS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteMutation(id: string): Promise<void> {
    const db = await this.getDb();
    if (!db || this.useFallback) return this.fallback.deleteMutation(id);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MUTATIONS, 'readwrite');
      const store = tx.objectStore(STORES.MUTATIONS);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- PERSISTENT QUERY CACHE API ---
  async putCache(item: StoredCacheEntry): Promise<void> {
    const db = await this.getDb();
    if (!db || this.useFallback) return this.fallback.putCache(item);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.CACHE, 'readwrite');
      const store = tx.objectStore(STORES.CACHE);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getCache(key: string): Promise<StoredCacheEntry | undefined> {
    const db = await this.getDb();
    if (!db || this.useFallback) return this.fallback.getCache(key);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.CACHE, 'readonly');
      const store = tx.objectStore(STORES.CACHE);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllCache(): Promise<StoredCacheEntry[]> {
    const db = await this.getDb();
    if (!db || this.useFallback) return this.fallback.getAllCache();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.CACHE, 'readonly');
      const store = tx.objectStore(STORES.CACHE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteCache(key: string): Promise<void> {
    const db = await this.getDb();
    if (!db || this.useFallback) return this.fallback.deleteCache(key);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.CACHE, 'readwrite');
      const store = tx.objectStore(STORES.CACHE);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async clearCache(): Promise<void> {
    const db = await this.getDb();
    if (!db || this.useFallback) return this.fallback.clearCache();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.CACHE, 'readwrite');
      const store = tx.objectStore(STORES.CACHE);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- MESSAGE OUTBOX API ---
  async putOutbox(item: StoredOutboxMessage): Promise<void> {
    const db = await this.getDb();
    if (!db || this.useFallback) return this.fallback.putOutbox(item);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.OUTBOX, 'readwrite');
      const store = tx.objectStore(STORES.OUTBOX);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getOutbox(id: string): Promise<StoredOutboxMessage | undefined> {
    const db = await this.getDb();
    if (!db || this.useFallback) return this.fallback.getOutbox(id);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.OUTBOX, 'readonly');
      const store = tx.objectStore(STORES.OUTBOX);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllOutbox(): Promise<StoredOutboxMessage[]> {
    const db = await this.getDb();
    if (!db || this.useFallback) return this.fallback.getAllOutbox();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.OUTBOX, 'readonly');
      const store = tx.objectStore(STORES.OUTBOX);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteOutbox(id: string): Promise<void> {
    const db = await this.getDb();
    if (!db || this.useFallback) return this.fallback.deleteOutbox(id);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.OUTBOX, 'readwrite');
      const store = tx.objectStore(STORES.OUTBOX);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

export const indexedDbQueue = new IndexedDbQueueStorage();
