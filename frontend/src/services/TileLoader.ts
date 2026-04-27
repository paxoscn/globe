/**
 * TileLoader — Prioritized tile fetching with cache-first loading.
 *
 * Responsibilities:
 * 1. Accept a list of TileCoord to load and a viewport center point
 * 2. Check MemoryManager cache first — skip tiles already cached
 * 3. Sort uncached tiles by ascending spherical distance from viewport center
 * 4. Fetch tiles from the backend API: GET /api/tiles/{layer_id}/{z}/{x}/{y}
 * 5. On success, store in MemoryManager cache
 * 6. On failure, retry up to 3 times with exponential backoff
 * 7. Track loading/error state per tile
 *
 * Requirements: 6.3, 6.4
 */

import type { TileCacheKey, TileCoord, TileData } from '../types';
import type { FeatureCollection } from '../types/geojson';
import type { MemoryManager } from './MemoryManager';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEG2RAD = Math.PI / 180;

/** Maximum number of retry attempts per tile fetch. */
const MAX_RETRIES = 3;

/** Base delay in ms for exponential backoff (doubles each retry). */
const BASE_BACKOFF_MS = 500;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Geographic point in degrees. */
export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Per-tile loading state. */
export type TileStatus = 'idle' | 'loading' | 'loaded' | 'error';

/** Tracked state for a single tile request. */
export interface TileLoadState {
  key: TileCacheKey;
  status: TileStatus;
  /** Number of retries attempted so far. */
  retries: number;
  /** Error message if status is 'error'. */
  errorMessage?: string;
}

/** Result of a tile load operation. */
export interface TileLoadResult {
  key: TileCacheKey;
  success: boolean;
  data?: TileData;
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// Spherical distance
// ---------------------------------------------------------------------------

/**
 * Compute the spherical distance (in radians) between two geographic points
 * using the Haversine formula.
 *
 * Exported for property testing (Property 8).
 *
 * @param a - First point in degrees.
 * @param b - Second point in degrees.
 * @returns Angular distance in radians ∈ [0, π].
 */
export function sphericalDistance(a: GeoPoint, b: GeoPoint): number {
  const lat1 = a.lat * DEG2RAD;
  const lat2 = b.lat * DEG2RAD;
  const dLat = (b.lat - a.lat) * DEG2RAD;
  const dLng = (b.lng - a.lng) * DEG2RAD;

  const sinHalfDLat = Math.sin(dLat / 2);
  const sinHalfDLng = Math.sin(dLng / 2);

  const h =
    sinHalfDLat * sinHalfDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinHalfDLng * sinHalfDLng;

  // Clamp to [0, 1] to guard against floating-point overshoot.
  return 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// ---------------------------------------------------------------------------
// Tile center helper
// ---------------------------------------------------------------------------

/**
 * Compute the geographic center (lat/lng in degrees) of a tile.
 *
 * Uses the standard Web Mercator (Slippy map) tiling scheme.
 */
export function tileCenterDeg(coord: TileCoord): GeoPoint {
  const n = 1 << coord.z; // 2^z
  const lng = ((coord.x + 0.5) / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (coord.y + 0.5)) / n)));
  const lat = latRad * (180 / Math.PI);
  return { lat, lng };
}

// ---------------------------------------------------------------------------
// Prioritization
// ---------------------------------------------------------------------------

/**
 * Sort tile coordinates by ascending spherical distance from a viewport center.
 *
 * Returns a new array (does not mutate the input).
 */
export function prioritizeTiles(
  tiles: TileCoord[],
  center: GeoPoint,
): TileCoord[] {
  return [...tiles].sort((a, b) => {
    const distA = sphericalDistance(center, tileCenterDeg(a));
    const distB = sphericalDistance(center, tileCenterDeg(b));
    return distA - distB;
  });
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

/**
 * Sleep for the given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build the cache key for a tile.
 */
export function buildCacheKey(layerId: string, coord: TileCoord): TileCacheKey {
  return `${layerId}:${coord.z}:${coord.x}:${coord.y}`;
}

/**
 * Fetch a single tile from the backend API with retry logic.
 *
 * @param layerId - The layer to fetch from.
 * @param coord - Tile coordinates.
 * @param signal - Optional AbortSignal for cancellation.
 * @returns The parsed GeoJSON FeatureCollection and approximate size.
 */
async function fetchTileWithRetry(
  layerId: string,
  coord: TileCoord,
  signal?: AbortSignal,
): Promise<{ geojson: FeatureCollection; sizeBytes: number }> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 500ms, 1000ms, 2000ms
      await sleep(BASE_BACKOFF_MS * Math.pow(2, attempt - 1));
    }

    try {
      const url = `/api/tiles/${encodeURIComponent(layerId)}/${coord.z}/${coord.x}/${coord.y}`;
      const response = await fetch(url, { signal });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      const geojson: FeatureCollection = JSON.parse(text);
      const sizeBytes = new TextEncoder().encode(text).byteLength;

      return { geojson, sizeBytes };
    } catch (err) {
      // Don't retry if the request was aborted.
      if (signal?.aborted) {
        throw err;
      }
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error('Tile fetch failed after retries');
}

// ---------------------------------------------------------------------------
// TileLoader
// ---------------------------------------------------------------------------

export class TileLoader {
  private memoryManager: MemoryManager;

  /** Per-tile loading state, keyed by TileCacheKey. */
  private states: Map<TileCacheKey, TileLoadState> = new Map();

  /** Optional callback invoked when any tile's state changes. */
  onStateChange?: (key: TileCacheKey, state: TileLoadState) => void;

  constructor(memoryManager: MemoryManager) {
    this.memoryManager = memoryManager;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Load a batch of tiles for a given layer, prioritized by distance from
   * the viewport center.
   *
   * - Tiles already in the MemoryManager cache are skipped.
   * - Uncached tiles are sorted by ascending spherical distance from `center`.
   * - Each tile is fetched, stored in cache, and its state tracked.
   *
   * @param layerId - Layer to load tiles for.
   * @param tiles - Tile coordinates to load.
   * @param center - Viewport center point (lat/lng in degrees).
   * @param signal - Optional AbortSignal for cancellation.
   * @returns Array of load results for uncached tiles.
   */
  async loadTiles(
    layerId: string,
    tiles: TileCoord[],
    center: GeoPoint,
    signal?: AbortSignal,
  ): Promise<TileLoadResult[]> {
    // 1. Filter out tiles already in cache.
    const uncached: TileCoord[] = [];
    for (const coord of tiles) {
      const key = buildCacheKey(layerId, coord);
      if (this.memoryManager.get(key) !== null) {
        // Already cached — mark as loaded.
        this.updateState(key, { key, status: 'loaded', retries: 0 });
      } else {
        uncached.push(coord);
      }
    }

    // 2. Sort uncached tiles by ascending spherical distance from center.
    const prioritized = prioritizeTiles(uncached, center);

    // 3. Fetch each tile sequentially (in priority order).
    const results: TileLoadResult[] = [];

    for (const coord of prioritized) {
      if (signal?.aborted) break;

      const key = buildCacheKey(layerId, coord);
      this.updateState(key, { key, status: 'loading', retries: 0 });

      try {
        const { geojson, sizeBytes } = await fetchTileWithRetry(
          layerId,
          coord,
          signal,
        );

        const tileData: TileData = {
          key,
          geojson,
          sizeBytes,
          lastAccessTime: Date.now(),
        };

        // Store in cache.
        this.memoryManager.put(key, tileData);

        this.updateState(key, { key, status: 'loaded', retries: 0 });
        results.push({ key, success: true, data: tileData });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : String(err);

        this.updateState(key, {
          key,
          status: 'error',
          retries: MAX_RETRIES,
          errorMessage,
        });

        results.push({ key, success: false, errorMessage });
      }
    }

    return results;
  }

  /**
   * Retry loading a single tile that previously failed.
   *
   * @param layerId - Layer to load from.
   * @param coord - Tile coordinates.
   * @param signal - Optional AbortSignal.
   * @returns The load result.
   */
  async retryTile(
    layerId: string,
    coord: TileCoord,
    signal?: AbortSignal,
  ): Promise<TileLoadResult> {
    const key = buildCacheKey(layerId, coord);
    this.updateState(key, { key, status: 'loading', retries: 0 });

    try {
      const { geojson, sizeBytes } = await fetchTileWithRetry(
        layerId,
        coord,
        signal,
      );

      const tileData: TileData = {
        key,
        geojson,
        sizeBytes,
        lastAccessTime: Date.now(),
      };

      this.memoryManager.put(key, tileData);
      this.updateState(key, { key, status: 'loaded', retries: 0 });

      return { key, success: true, data: tileData };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : String(err);

      this.updateState(key, {
        key,
        status: 'error',
        retries: MAX_RETRIES,
        errorMessage,
      });

      return { key, success: false, errorMessage };
    }
  }

  /**
   * Get the current loading state for a tile.
   */
  getState(key: TileCacheKey): TileLoadState | undefined {
    return this.states.get(key);
  }

  /**
   * Get all tracked tile states.
   */
  getAllStates(): Map<TileCacheKey, TileLoadState> {
    return new Map(this.states);
  }

  /**
   * Clear all tracked states.
   */
  clearStates(): void {
    this.states.clear();
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private updateState(key: TileCacheKey, state: TileLoadState): void {
    this.states.set(key, state);
    this.onStateChange?.(key, state);
  }
}
