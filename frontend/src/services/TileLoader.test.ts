import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sphericalDistance,
  tileCenterDeg,
  prioritizeTiles,
  buildCacheKey,
  TileLoader,
} from './TileLoader';
import { MemoryManager } from './MemoryManager';
import type { TileCacheKey, TileCoord, TileData } from '../types';
import type { GeoPoint } from './TileLoader';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MB = 1024 * 1024;

function makeTile(key: TileCacheKey, sizeMB: number = 1): TileData {
  return {
    key,
    geojson: { type: 'FeatureCollection', features: [] },
    sizeBytes: sizeMB * MB,
    lastAccessTime: Date.now(),
  };
}

/**
 * Create a mock fetch that returns a GeoJSON FeatureCollection for any tile URL.
 */
function mockFetchSuccess() {
  const geojson = JSON.stringify({ type: 'FeatureCollection', features: [] });
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: () => Promise.resolve(geojson),
  });
}

/**
 * Create a mock fetch that always fails with a network error.
 */
function mockFetchFailure(message = 'Network error') {
  return vi.fn().mockRejectedValue(new Error(message));
}

/**
 * Create a mock fetch that fails N times then succeeds.
 */
function mockFetchFailThenSucceed(failCount: number) {
  let calls = 0;
  const geojson = JSON.stringify({ type: 'FeatureCollection', features: [] });
  return vi.fn().mockImplementation(() => {
    calls++;
    if (calls <= failCount) {
      return Promise.reject(new Error(`Attempt ${calls} failed`));
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve(geojson),
    });
  });
}

// ---------------------------------------------------------------------------
// sphericalDistance
// ---------------------------------------------------------------------------

describe('sphericalDistance', () => {
  it('returns 0 for identical points', () => {
    const p: GeoPoint = { lat: 45, lng: 90 };
    expect(sphericalDistance(p, p)).toBeCloseTo(0, 10);
  });

  it('returns π for antipodal points', () => {
    const a: GeoPoint = { lat: 0, lng: 0 };
    const b: GeoPoint = { lat: 0, lng: 180 };
    expect(sphericalDistance(a, b)).toBeCloseTo(Math.PI, 5);
  });

  it('returns π/2 for points 90° apart on the equator', () => {
    const a: GeoPoint = { lat: 0, lng: 0 };
    const b: GeoPoint = { lat: 0, lng: 90 };
    expect(sphericalDistance(a, b)).toBeCloseTo(Math.PI / 2, 5);
  });

  it('returns π/2 for equator to pole', () => {
    const a: GeoPoint = { lat: 0, lng: 0 };
    const b: GeoPoint = { lat: 90, lng: 0 };
    expect(sphericalDistance(a, b)).toBeCloseTo(Math.PI / 2, 5);
  });

  it('is symmetric', () => {
    const a: GeoPoint = { lat: 30, lng: 45 };
    const b: GeoPoint = { lat: -20, lng: 120 };
    expect(sphericalDistance(a, b)).toBeCloseTo(sphericalDistance(b, a), 10);
  });

  it('is always non-negative', () => {
    const a: GeoPoint = { lat: -45, lng: -90 };
    const b: GeoPoint = { lat: 60, lng: 170 };
    expect(sphericalDistance(a, b)).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// tileCenterDeg
// ---------------------------------------------------------------------------

describe('tileCenterDeg', () => {
  it('returns a point within valid lat/lng range', () => {
    const center = tileCenterDeg({ z: 2, x: 1, y: 1 });
    expect(center.lat).toBeGreaterThanOrEqual(-90);
    expect(center.lat).toBeLessThanOrEqual(90);
    expect(center.lng).toBeGreaterThanOrEqual(-180);
    expect(center.lng).toBeLessThanOrEqual(180);
  });

  it('returns center near (0, 0) for the appropriate tile at z=1', () => {
    // At z=1, there are 2x2 tiles. Tile (1, 0) covers roughly lng [0, 180], lat [0, 85]
    const center = tileCenterDeg({ z: 1, x: 1, y: 0 });
    expect(center.lng).toBeGreaterThan(0);
    expect(center.lat).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// prioritizeTiles
// ---------------------------------------------------------------------------

describe('prioritizeTiles', () => {
  it('returns an empty array for empty input', () => {
    const result = prioritizeTiles([], { lat: 0, lng: 0 });
    expect(result).toEqual([]);
  });

  it('returns a single tile unchanged', () => {
    const tiles: TileCoord[] = [{ z: 2, x: 1, y: 1 }];
    const result = prioritizeTiles(tiles, { lat: 0, lng: 0 });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(tiles[0]);
  });

  it('sorts tiles by ascending distance from center', () => {
    const center: GeoPoint = { lat: 0, lng: 0 };
    // Create tiles at different distances from (0, 0)
    const tiles: TileCoord[] = [
      { z: 2, x: 3, y: 1 }, // far from (0,0)
      { z: 2, x: 2, y: 1 }, // medium
      { z: 2, x: 1, y: 1 }, // closer to (0,0)
    ];

    const result = prioritizeTiles(tiles, center);

    // Verify ascending distance order
    for (let i = 1; i < result.length; i++) {
      const distPrev = sphericalDistance(center, tileCenterDeg(result[i - 1]));
      const distCurr = sphericalDistance(center, tileCenterDeg(result[i]));
      expect(distPrev).toBeLessThanOrEqual(distCurr);
    }
  });

  it('does not mutate the input array', () => {
    const tiles: TileCoord[] = [
      { z: 2, x: 3, y: 1 },
      { z: 2, x: 0, y: 1 },
    ];
    const original = [...tiles];
    prioritizeTiles(tiles, { lat: 0, lng: 0 });
    expect(tiles).toEqual(original);
  });
});

// ---------------------------------------------------------------------------
// buildCacheKey
// ---------------------------------------------------------------------------

describe('buildCacheKey', () => {
  it('builds the correct key format', () => {
    expect(buildCacheKey('coastline', { z: 3, x: 4, y: 5 })).toBe(
      'coastline:3:4:5',
    );
  });
});

// ---------------------------------------------------------------------------
// TileLoader
// ---------------------------------------------------------------------------

describe('TileLoader', () => {
  let mm: MemoryManager;
  let loader: TileLoader;

  beforeEach(() => {
    vi.useFakeTimers();
    mm = new MemoryManager({ maxMemoryMB: 256 });
    loader = new TileLoader(mm);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // -- Cache-first loading --------------------------------------------------

  describe('cache-first loading', () => {
    it('skips tiles already in cache', async () => {
      const fetchMock = mockFetchSuccess();
      vi.stubGlobal('fetch', fetchMock);

      // Pre-populate cache
      const key: TileCacheKey = 'layer1:2:1:1';
      mm.put(key, makeTile(key, 1));

      const results = await loader.loadTiles(
        'layer1',
        [{ z: 2, x: 1, y: 1 }],
        { lat: 0, lng: 0 },
      );

      // No fetch should have been made
      expect(fetchMock).not.toHaveBeenCalled();
      // No results for already-cached tiles
      expect(results).toHaveLength(0);

      vi.unstubAllGlobals();
    });

    it('fetches uncached tiles and stores them in cache', async () => {
      const fetchMock = mockFetchSuccess();
      vi.stubGlobal('fetch', fetchMock);

      const results = await loader.loadTiles(
        'layer1',
        [{ z: 2, x: 1, y: 1 }],
        { lat: 0, lng: 0 },
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);

      // Verify tile is now in cache
      expect(mm.has('layer1:2:1:1')).toBe(true);

      vi.unstubAllGlobals();
    });
  });

  // -- Prioritization -------------------------------------------------------

  describe('request prioritization', () => {
    it('fetches tiles in order of ascending distance from center', async () => {
      const fetchOrder: string[] = [];
      const geojson = JSON.stringify({
        type: 'FeatureCollection',
        features: [],
      });

      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
          fetchOrder.push(url);
          return Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            text: () => Promise.resolve(geojson),
          });
        }),
      );

      const center: GeoPoint = { lat: 0, lng: 0 };
      // Tile at x=0 is closer to lng=0 than tile at x=3
      const tiles: TileCoord[] = [
        { z: 2, x: 3, y: 1 }, // far
        { z: 2, x: 1, y: 1 }, // closer
      ];

      await loader.loadTiles('layer1', tiles, center);

      // The closer tile (x=1) should be fetched before the farther tile (x=3)
      expect(fetchOrder).toHaveLength(2);
      expect(fetchOrder[0]).toContain('/2/1/1');
      expect(fetchOrder[1]).toContain('/2/3/1');

      vi.unstubAllGlobals();
    });
  });

  // -- Retry logic ----------------------------------------------------------

  describe('retry logic', () => {
    it('retries up to 3 times on failure with exponential backoff', async () => {
      // Fail all 4 attempts (initial + 3 retries)
      const fetchMock = mockFetchFailure('Server error');
      vi.stubGlobal('fetch', fetchMock);

      const promise = loader.loadTiles(
        'layer1',
        [{ z: 2, x: 1, y: 1 }],
        { lat: 0, lng: 0 },
      );

      // Advance through all backoff timers
      // Attempt 0: immediate
      // Attempt 1: 500ms backoff
      // Attempt 2: 1000ms backoff
      // Attempt 3: 2000ms backoff
      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);

      const results = await promise;

      // 1 initial + 3 retries = 4 total calls
      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].errorMessage).toBe('Server error');

      vi.unstubAllGlobals();
    });

    it('succeeds after transient failures', async () => {
      // Fail twice, then succeed on third attempt
      const fetchMock = mockFetchFailThenSucceed(2);
      vi.stubGlobal('fetch', fetchMock);

      const promise = loader.loadTiles(
        'layer1',
        [{ z: 2, x: 1, y: 1 }],
        { lat: 0, lng: 0 },
      );

      // Advance through backoff timers
      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(1000);

      const results = await promise;

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);

      vi.unstubAllGlobals();
    });
  });

  // -- State tracking -------------------------------------------------------

  describe('state tracking', () => {
    it('tracks loading state transitions', async () => {
      const fetchMock = mockFetchSuccess();
      vi.stubGlobal('fetch', fetchMock);

      const stateChanges: Array<{ key: TileCacheKey; status: string }> = [];
      loader.onStateChange = (key, state) => {
        stateChanges.push({ key, status: state.status });
      };

      await loader.loadTiles(
        'layer1',
        [{ z: 2, x: 1, y: 1 }],
        { lat: 0, lng: 0 },
      );

      expect(stateChanges).toEqual([
        { key: 'layer1:2:1:1', status: 'loading' },
        { key: 'layer1:2:1:1', status: 'loaded' },
      ]);

      vi.unstubAllGlobals();
    });

    it('tracks error state on failure', async () => {
      const fetchMock = mockFetchFailure('Timeout');
      vi.stubGlobal('fetch', fetchMock);

      const promise = loader.loadTiles(
        'layer1',
        [{ z: 2, x: 1, y: 1 }],
        { lat: 0, lng: 0 },
      );

      await vi.advanceTimersByTimeAsync(500 + 1000 + 2000);
      await promise;

      const state = loader.getState('layer1:2:1:1');
      expect(state).toBeDefined();
      expect(state!.status).toBe('error');
      expect(state!.errorMessage).toBe('Timeout');

      vi.unstubAllGlobals();
    });

    it('getState returns undefined for unknown keys', () => {
      expect(loader.getState('unknown:0:0:0')).toBeUndefined();
    });

    it('clearStates removes all tracked states', async () => {
      const fetchMock = mockFetchSuccess();
      vi.stubGlobal('fetch', fetchMock);

      await loader.loadTiles(
        'layer1',
        [{ z: 2, x: 1, y: 1 }],
        { lat: 0, lng: 0 },
      );

      expect(loader.getAllStates().size).toBe(1);
      loader.clearStates();
      expect(loader.getAllStates().size).toBe(0);

      vi.unstubAllGlobals();
    });
  });

  // -- retryTile ------------------------------------------------------------

  describe('retryTile', () => {
    it('retries a previously failed tile', async () => {
      const fetchMock = mockFetchSuccess();
      vi.stubGlobal('fetch', fetchMock);

      const result = await loader.retryTile('layer1', { z: 2, x: 1, y: 1 });

      expect(result.success).toBe(true);
      expect(mm.has('layer1:2:1:1')).toBe(true);

      const state = loader.getState('layer1:2:1:1');
      expect(state!.status).toBe('loaded');

      vi.unstubAllGlobals();
    });
  });

  // -- HTTP error handling --------------------------------------------------

  describe('HTTP error responses', () => {
    it('treats non-ok HTTP responses as errors', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          text: () => Promise.resolve(''),
        }),
      );

      const promise = loader.loadTiles(
        'layer1',
        [{ z: 2, x: 1, y: 1 }],
        { lat: 0, lng: 0 },
      );

      await vi.advanceTimersByTimeAsync(500 + 1000 + 2000);
      const results = await promise;

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].errorMessage).toContain('404');

      vi.unstubAllGlobals();
    });
  });

  // -- Abort signal ---------------------------------------------------------

  describe('abort signal', () => {
    it('stops loading when signal is aborted', async () => {
      const fetchMock = mockFetchSuccess();
      vi.stubGlobal('fetch', fetchMock);

      const controller = new AbortController();
      // Abort immediately
      controller.abort();

      const results = await loader.loadTiles(
        'layer1',
        [{ z: 2, x: 1, y: 1 }, { z: 2, x: 2, y: 1 }],
        { lat: 0, lng: 0 },
        controller.signal,
      );

      // Should not have fetched any tiles since signal was already aborted
      expect(results).toHaveLength(0);

      vi.unstubAllGlobals();
    });
  });
});
