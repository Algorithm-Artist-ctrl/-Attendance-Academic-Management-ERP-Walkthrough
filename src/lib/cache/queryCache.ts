/**
 * Stale-While-Revalidate (SWR) Client Query Cache & Request Deduplicator
 * Provides instant cached data rendering (0ms), background silent revalidation,
 * in-flight Promise sharing to prevent duplicate network roundtrips,
 * and persistent IndexedDB storage for instant offline / cold-start paints.
 */

import { indexedDbQueue } from '../storage/indexedDbQueue';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

class QueryCacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private inFlight = new Map<string, Promise<any>>();
  private abortControllers = new Map<string, AbortController>();
  private isHydrated = false;

  // Default TTL: 15 minutes; default staleTime: 45 seconds
  private DEFAULT_TTL_MS = 15 * 60 * 1000;
  private DEFAULT_STALE_TIME_MS = 45 * 1000;

  constructor() {
    this.hydrateFromDisk();
  }

  /**
   * Hydrates memory cache from persistent IndexedDB storage on startup.
   */
  async hydrateFromDisk(): Promise<void> {
    if (this.isHydrated) return;
    try {
      const stored = await indexedDbQueue.getAllCache();
      const now = Date.now();
      for (const entry of stored) {
        if (now - entry.timestamp < entry.ttl_ms) {
          this.cache.set(entry.cache_key, {
            data: entry.data,
            timestamp: entry.timestamp,
            ttlMs: entry.ttl_ms,
          });
        } else {
          // Prune expired entry
          indexedDbQueue.deleteCache(entry.cache_key).catch(() => {});
        }
      }
      this.isHydrated = true;
    } catch (err) {
      console.warn('[QueryCache] Hydration warning:', err);
    }
  }

  /**
   * Retrieves data from cache synchronously if present and not expired
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > entry.ttlMs) {
      this.cache.delete(key);
      indexedDbQueue.deleteCache(key).catch(() => {});
      return undefined;
    }
    return entry.data as T;
  }

  /**
   * Checks if non-expired data is present in cache
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Directly sets data in memory and persists to IndexedDB
   */
  set<T>(key: string, data: T, ttlMs?: number, persistToDisk = true): void {
    const ttl = ttlMs ?? this.DEFAULT_TTL_MS;
    const now = Date.now();

    this.cache.set(key, {
      data,
      timestamp: now,
      ttlMs: ttl,
    });

    if (persistToDisk) {
      indexedDbQueue.putCache({
        cache_key: key,
        data,
        timestamp: now,
        ttl_ms: ttl,
      }).catch((err) => console.warn('[QueryCache] Disk persistence warning:', err));
    }
  }

  /**
   * Surgically update a cache entry in place (e.g. from a Supabase Realtime event)
   * without triggering a full page refetch.
   */
  update<T>(key: string, updater: (old: T | undefined) => T, ttlMs?: number): T {
    const oldVal = this.get<T>(key);
    const nextVal = updater(oldVal);
    this.set(key, nextVal, ttlMs);
    return nextVal;
  }

  /**
   * Alias for fetchWithCache
   */
  getOrFetch<T>(
    key: string,
    fetcher: (signal?: AbortSignal) => Promise<T>,
    options?: {
      ttlMs?: number;
      staleTimeMs?: number;
      forceFresh?: boolean;
      persistToDisk?: boolean;
      onBackgroundUpdate?: (data: T) => void;
    }
  ): Promise<T> {
    return this.fetchWithCache(key, fetcher, options);
  }

  /**
   * Checks if an existing cache entry is older than its stale threshold
   */
  isStale(key: string, staleTimeMs?: number): boolean {
    const entry = this.cache.get(key);
    if (!entry) return true;
    const threshold = staleTimeMs ?? this.DEFAULT_STALE_TIME_MS;
    return Date.now() - entry.timestamp > threshold;
  }

  /**
   * Core SWR Fetcher with in-flight Promise deduplication and AbortController support:
   * 1. Returns fresh cache instantly (< 1ms).
   * 2. Returns stale cache instantly while triggering a silent background revalidation.
   * 3. Deduplicates concurrent calls to the same key into a single network Promise.
   */
  async fetchWithCache<T>(
    key: string,
    fetcher: (signal?: AbortSignal) => Promise<T>,
    options?: {
      ttlMs?: number;
      staleTimeMs?: number;
      forceFresh?: boolean;
      persistToDisk?: boolean;
      onBackgroundUpdate?: (data: T) => void;
    }
  ): Promise<T> {
    const ttlMs = options?.ttlMs ?? this.DEFAULT_TTL_MS;
    const staleTimeMs = options?.staleTimeMs ?? this.DEFAULT_STALE_TIME_MS;
    const forceFresh = options?.forceFresh ?? false;
    const persistToDisk = options?.persistToDisk ?? true;

    // 1. If not forcing fresh, check memory cache
    if (!forceFresh) {
      const entry = this.cache.get(key);
      if (entry && (Date.now() - entry.timestamp < entry.ttlMs)) {
        const isStale = (Date.now() - entry.timestamp) > staleTimeMs;
        if (!isStale) {
          // Fresh cache hit - return immediately (0ms)
          return entry.data as T;
        }

        // Stale cache hit - return stale data immediately and revalidate in background
        this.revalidateInBackground(key, fetcher, ttlMs, persistToDisk, options?.onBackgroundUpdate);
        return entry.data as T;
      }
    }

    // 2. Check in-flight promise to eliminate duplicate parallel network queries
    const activePromise = this.inFlight.get(key);
    if (activePromise) {
      return activePromise as Promise<T>;
    }

    // 3. Initiate fetch with in-flight tracking & abort controller
    const controller = new AbortController();
    this.abortControllers.set(key, controller);

    const promise = (async () => {
      try {
        const result = await fetcher(controller.signal);
        if (result !== undefined && result !== null) {
          this.set(key, result, ttlMs, persistToDisk);
        }
        return result;
      } finally {
        this.inFlight.delete(key);
        this.abortControllers.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    return promise;
  }

  private revalidateInBackground<T>(
    key: string,
    fetcher: (signal?: AbortSignal) => Promise<T>,
    ttlMs: number,
    persistToDisk: boolean,
    onBackgroundUpdate?: (data: T) => void
  ): void {
    if (this.inFlight.has(key)) return;

    const controller = new AbortController();
    this.abortControllers.set(key, controller);

    const promise = (async () => {
      try {
        const freshData = await fetcher(controller.signal);
        if (freshData !== undefined && freshData !== null) {
          this.set(key, freshData, ttlMs, persistToDisk);
          if (onBackgroundUpdate) {
            try {
              onBackgroundUpdate(freshData);
            } catch (cbErr) {
              console.warn('[QueryCache] Background update callback warning:', cbErr);
            }
          }
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.warn(`[QueryCache] Background revalidation failed for ${key}:`, err);
        }
      } finally {
        this.inFlight.delete(key);
        this.abortControllers.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
  }

  /**
   * Cancel active in-flight requests matching key or prefix
   */
  cancelInFlight(keyPrefix?: string): void {
    for (const [key, controller] of this.abortControllers.entries()) {
      if (!keyPrefix || key.startsWith(keyPrefix)) {
        try {
          controller.abort();
        } catch {}
        this.abortControllers.delete(key);
        this.inFlight.delete(key);
      }
    }
  }

  /**
   * Invalidate exact key from memory and persistent disk
   */
  invalidate(key: string): void {
    this.cache.delete(key);
    this.inFlight.delete(key);
    const controller = this.abortControllers.get(key);
    if (controller) {
      try { controller.abort(); } catch {}
      this.abortControllers.delete(key);
    }
    indexedDbQueue.deleteCache(key).catch(() => {});
  }

  /**
   * Invalidate all keys matching a prefix or regex pattern
   */
  invalidatePattern(pattern: string | RegExp): void {
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (typeof pattern === 'string') {
        if (key.startsWith(pattern) || key.includes(pattern)) {
          keysToDelete.push(key);
        }
      } else if (pattern.test(key)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(k => this.invalidate(k));
  }

  /**
   * Clear all cached items and in-flight promises
   */
  clear(): void {
    this.cache.clear();
    this.cancelInFlight();
    indexedDbQueue.clearCache().catch(() => {});
  }

  /**
   * Returns cache size for diagnostics and tests
   */
  get size(): number {
    return this.cache.size;
  }
}

export const queryCache = new QueryCacheManager();

/**
 * Common standard query key factory
 */
export const queryKeys = {
  masterData: (scope = 'all') => `master:${scope}`,
  notices: (status = 'active') => `notices:${status}`,
  studentAttendance: (studentId: string, sectionId?: string) => `student_att:${studentId}_${sectionId || 'none'}`,
  studentAcademicRecords: (studentId: string, sectionId?: string) => `student_acad:${studentId}_${sectionId || 'none'}`,
  facultyAcademicRecords: (facultyId: string) => `faculty_acad:${facultyId}`,
  facultyDashboard: (facultyId: string) => `faculty_dash:${facultyId}`,
  timetable: (sectionId?: string) => `timetable:${sectionId || 'all'}`,
  assessmentMarks: (assessmentId: string, kind: string) => `marks:${kind}_${assessmentId}`,
  notifications: (userId?: string, role?: string) => `notifs:${userId || 'anon'}_${role || 'any'}`,
  sections: () => `sections:active`,
  subjects: () => `subjects:active`,
  faculty: () => `faculty:all`,
};
