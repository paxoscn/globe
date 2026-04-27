/**
 * Memory_Manager — LRU cache for tile data with configurable memory limits.
 *
 * Uses `Map` insertion-order for LRU semantics:
 *   - access (get) = delete + reinsert → moves entry to end
 *   - evict = take first entry (oldest access)
 *
 * Memory limits:
 *   - Desktop: 256 MB
 *   - Mobile:  128 MB (detected via navigator.maxTouchPoints or screen width)
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */

import type { TileCacheKey, TileData, Viewport, TileCoord } from '../types';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface MemoryManagerConfig {
  /** Memory limit in megabytes. Desktop default 256, mobile default 128. */
  maxMemoryMB: number;
  /** Delay (ms) before evicting tiles that left the viewport. Default 30 000. */
  evictionTimeoutMs: number;
}

const BYTES_PER_MB = 1024 * 1024;

// ---------------------------------------------------------------------------
// Device detection helper
// ---------------------------------------------------------------------------

/**
 * Heuristic to decide whether the current device is "mobile".
 * Checks `navigator.maxTouchPoints` first, then falls back to screen width.
 */
export function isMobileDevice(): boolean {
  if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) {
    // Devices with touch AND a narrow screen are treated as mobile.
    // Touch-enabled laptops typically have wider screens.
    if (typeof screen !== 'undefined' && screen.width <= 1024) {
      return true;
    }
    // Pure touch device (no mouse-style pointer) — treat as mobile
    // when maxTouchPoints is high (phones/tablets typically report ≥ 2).
    if (navigator.maxTouchPoints >= 2 && typeof screen !== 'undefined' && screen.width <= 1366) {
      return true;
    }
  }
  if (typeof screen !== 'undefined' && screen.width <= 768) {
    return true;
  }
  return false;
}

/**
 * Build a default config based on device type.
 */
export function defaultConfig(): MemoryManagerConfig {
  const mobile = isMobileDevice();
  return {
    maxMemoryMB: mobile ? 128 : 256,
    evictionTimeoutMs: 30_000,
  };
}

// ---------------------------------------------------------------------------
// MemoryManager
// ---------------------------------------------------------------------------

export class MemoryManager {
  /** LRU cache — Map preserves insertion order. */
  private cache: Map<TileCacheKey, TileData> = new Map();

  /** Running total of cached bytes. */
  private totalBytes = 0;

  /** Maximum allowed bytes derived from config. */
  private readonly maxBytes: number;

  /** Eviction timeout in ms. */
  private readonly evictionTimeoutMs: number;

  /**
   * Tracks tiles that have left the viewport.
   * Maps key → timestamp when the tile was first detected outside the viewport.
   */
  private outOfViewportTimestamps: Map<TileCacheKey, number> = new Map();

  constructor(config?: Partial<MemoryManagerConfig>) {
    const resolved = { ...defaultConfig(), ...config };
    this.maxBytes = resolved.maxMemoryMB * BYTES_PER_MB;
    this.evictionTimeoutMs = resolved.evictionTimeoutMs;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Retrieve a cached tile. Returns `null` on cache miss.
   * On hit the entry is promoted to most-recently-used.
   */
  get(key: TileCacheKey): TileData | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Promote: delete then reinsert so it moves to the end of the Map.
    this.cache.delete(key);
    entry.lastAccessTime = Date.now();
    this.cache.set(key, entry);
    return entry;
  }

  /**
   * Insert (or update) a tile in the cache.
   * If the new entry would exceed the memory limit, LRU entries are evicted
   * until there is room.
   */
  put(key: TileCacheKey, data: TileData): void {
    // If the key already exists, remove the old entry first.
    if (this.cache.has(key)) {
      const old = this.cache.get(key)!;
      this.totalBytes -= old.sizeBytes;
      this.cache.delete(key);
    }

    // Evict LRU entries until there is room for the new data.
    this.evictUntilFits(data.sizeBytes);

    data.lastAccessTime = Date.now();
    this.cache.set(key, data);
    this.totalBytes += data.sizeBytes;
  }

  /**
   * Evict tiles that have been outside the given viewport for longer than
   * `evictionTimeoutMs`.
   *
   * Requirement 8.1: tiles that leave the viewport beyond a time threshold
   * are released.
   */
  evictOutOfViewport(currentViewport: Viewport): void {
    const now = Date.now();
    const visibleSet = this.buildVisibleKeySet(currentViewport);

    // Update out-of-viewport timestamps.
    for (const key of this.cache.keys()) {
      if (visibleSet.has(key)) {
        // Tile is back in viewport — clear its timer.
        this.outOfViewportTimestamps.delete(key);
      } else if (!this.outOfViewportTimestamps.has(key)) {
        // First time we notice this tile is outside the viewport.
        this.outOfViewportTimestamps.set(key, now);
      }
    }

    // Evict tiles whose out-of-viewport time exceeds the threshold.
    for (const [key, leftAt] of this.outOfViewportTimestamps) {
      if (now - leftAt >= this.evictionTimeoutMs) {
        this.removeCacheEntry(key);
        this.outOfViewportTimestamps.delete(key);
      }
    }
  }

  /**
   * Return the current total memory usage in bytes.
   */
  getMemoryUsage(): number {
    return this.totalBytes;
  }

  /**
   * Return the configured maximum memory in bytes.
   */
  getMaxMemory(): number {
    return this.maxBytes;
  }

  /**
   * Return the number of entries currently in the cache.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Check whether a key exists in the cache (without promoting it).
   */
  has(key: TileCacheKey): boolean {
    return this.cache.has(key);
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  /**
   * Evict LRU entries (first entries in the Map) until `neededBytes` can fit
   * within the memory limit.
   */
  private evictUntilFits(neededBytes: number): void {
    while (this.totalBytes + neededBytes > this.maxBytes && this.cache.size > 0) {
      // Map iterator yields entries in insertion order — first = LRU.
      const firstKey = this.cache.keys().next().value as TileCacheKey;
      this.removeCacheEntry(firstKey);
    }
  }

  /**
   * Remove a single entry from the cache and update bookkeeping.
   */
  private removeCacheEntry(key: TileCacheKey): void {
    const entry = this.cache.get(key);
    if (entry) {
      this.totalBytes -= entry.sizeBytes;
      this.cache.delete(key);
    }
  }

  /**
   * Build a Set of TileCacheKeys that are currently visible.
   *
   * The visible tiles come from the viewport's `visibleTiles` array.
   * Since we don't know which layers are active here, we match by tile
   * coordinates (z:x:y suffix) against all cached keys.
   */
  private buildVisibleKeySet(viewport: Viewport): Set<TileCacheKey> {
    const coordStrings = new Set(
      viewport.visibleTiles.map((t: TileCoord) => `${t.z}:${t.x}:${t.y}`),
    );

    const visible = new Set<TileCacheKey>();
    for (const key of this.cache.keys()) {
      // key format: "layerId:z:x:y"
      const parts = key.split(':');
      if (parts.length >= 4) {
        const coordPart = parts.slice(-3).join(':');
        if (coordStrings.has(coordPart)) {
          visible.add(key);
        }
      }
    }
    return visible;
  }
}
