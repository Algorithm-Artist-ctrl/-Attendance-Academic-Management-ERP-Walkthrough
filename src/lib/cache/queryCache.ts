/**
 * Stale-While-Revalidate (SWR) Client Query Cache & Request Deduplicator
 * Provides instant cached data rendering (0ms), background silent revalidation,
 * and in-flight Promise sharing to prevent duplicate network roundtrips.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

class QueryCacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private inFlight = new Map<string, Promise<any>>();

  // Default TTL: 5 minutes; default staleTime: 30 seconds
  private DEFAULT_TTL_MS = 5 * 60 * 1000;
  private DEFAULT_STALE_TIME_MS = 30 * 1000;

  /**
   * Retrieves data from cache synchronously if present and not expired
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > entry.ttlMs) {
      this.cache.delete(key);
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
   * Directly sets data in cache
   */
  set<T>(key: string, data: T, ttlMs?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttlMs: ttlMs ?? this.DEFAULT_TTL_MS,
    });
  }

  /**
   * Alias for fetchWithCache
   */
  getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: {
      ttlMs?: number;
      staleTimeMs?: number;
      forceFresh?: boolean;
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
   * Core SWR Fetcher with in-flight Promise deduplication:
   * 1. Returns fresh cache instantly (< 1ms).
   * 2. Returns stale cache instantly while triggering a silent background revalidation.
   * 3. Deduplicates concurrent calls to the same key into a single network Promise.
   */
  async fetchWithCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: {
      ttlMs?: number;
      staleTimeMs?: number;
      forceFresh?: boolean;
      onBackgroundUpdate?: (data: T) => void;
    }
  ): Promise<T> {
    const ttlMs = options?.ttlMs ?? this.DEFAULT_TTL_MS;
    const staleTimeMs = options?.staleTimeMs ?? this.DEFAULT_STALE_TIME_MS;
    const forceFresh = options?.forceFresh ?? false;

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
        this.revalidateInBackground(key, fetcher, ttlMs, options?.onBackgroundUpdate);
        return entry.data as T;
      }
    }

    // 2. Check in-flight promise to eliminate duplicate parallel network queries
    const activePromise = this.inFlight.get(key);
    if (activePromise) {
      return activePromise as Promise<T>;
    }

    // 3. Initiate fetch with in-flight tracking
    const promise = (async () => {
      try {
        const result = await fetcher();
        if (result !== undefined && result !== null) {
          this.set(key, result, ttlMs);
        }
        return result;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    return promise;
  }

  private revalidateInBackground<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number,
    onBackgroundUpdate?: (data: T) => void
  ): void {
    if (this.inFlight.has(key)) return;

    const promise = (async () => {
      try {
        const freshData = await fetcher();
        if (freshData !== undefined && freshData !== null) {
          this.set(key, freshData, ttlMs);
          if (onBackgroundUpdate) {
            try {
              onBackgroundUpdate(freshData);
            } catch (cbErr) {
              console.warn('QueryCache background update callback warning:', cbErr);
            }
          }
        }
      } catch (err) {
        console.warn(`QueryCache background revalidation failed for ${key}:`, err);
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
  }

  /**
   * Invalidate exact key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
    this.inFlight.delete(key);
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
    keysToDelete.forEach(k => {
      this.cache.delete(k);
      this.inFlight.delete(k);
    });
  }

  /**
   * Clear all cached items and in-flight promises
   */
  clear(): void {
    this.cache.clear();
    this.inFlight.clear();
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
