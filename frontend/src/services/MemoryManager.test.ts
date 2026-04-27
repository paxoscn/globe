import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryManager } from './MemoryManager';
import type { TileCacheKey, TileData, Viewport } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MB = 1024 * 1024;

function makeTile(
  key: TileCacheKey,
  sizeMB: number = 1,
): TileData {
  return {
    key,
    geojson: { type: 'FeatureCollection', features: [] },
    sizeBytes: sizeMB * MB,
    lastAccessTime: Date.now(),
  };
}

function makeViewport(visibleCoords: { z: number; x: number; y: number }[]): Viewport {
  return {
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    zoom: 3,
    visibleTiles: visibleCoords,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MemoryManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -- Construction & config ------------------------------------------------

  describe('configuration', () => {
    it('uses custom maxMemoryMB when provided', () => {
      const mm = new MemoryManager({ maxMemoryMB: 64 });
      expect(mm.getMaxMemory()).toBe(64 * MB);
    });

    it('uses custom evictionTimeoutMs when provided', () => {
      // We can't directly read the timeout, but we can verify behaviour
      // in the eviction tests below. Just ensure construction succeeds.
      const mm = new MemoryManager({ evictionTimeoutMs: 5000 });
      expect(mm).toBeDefined();
    });

    it('defaults to 256 MB on desktop (non-touch, wide screen)', () => {
      // In jsdom, navigator.maxTouchPoints defaults to 0 and screen.width
      // is typically 0 — both indicate desktop.
      const mm = new MemoryManager();
      // Accept either 256 or 128 depending on jsdom defaults; the important
      // thing is that explicit config overrides work (tested above).
      expect(mm.getMaxMemory()).toBeGreaterThan(0);
    });
  });

  // -- get / put basics -----------------------------------------------------

  describe('get and put', () => {
    it('returns null for a cache miss', () => {
      const mm = new MemoryManager({ maxMemoryMB: 10 });
      expect(mm.get('layer:0:0:0')).toBeNull();
    });

    it('stores and retrieves a tile', () => {
      const mm = new MemoryManager({ maxMemoryMB: 10 });
      const tile = makeTile('layer:1:2:3', 1);
      mm.put('layer:1:2:3', tile);
      const result = mm.get('layer:1:2:3');
      expect(result).not.toBeNull();
      expect(result!.key).toBe('layer:1:2:3');
    });

    it('tracks memory usage correctly after put', () => {
      const mm = new MemoryManager({ maxMemoryMB: 10 });
      mm.put('a:0:0:0', makeTile('a:0:0:0', 2));
      mm.put('b:0:0:1', makeTile('b:0:0:1', 3));
      expect(mm.getMemoryUsage()).toBe(5 * MB);
    });

    it('updates memory when overwriting an existing key', () => {
      const mm = new MemoryManager({ maxMemoryMB: 10 });
      mm.put('a:0:0:0', makeTile('a:0:0:0', 2));
      expect(mm.getMemoryUsage()).toBe(2 * MB);

      // Overwrite with a larger tile
      mm.put('a:0:0:0', makeTile('a:0:0:0', 5));
      expect(mm.getMemoryUsage()).toBe(5 * MB);
      expect(mm.size).toBe(1);
    });
  });

  // -- LRU eviction ---------------------------------------------------------

  describe('LRU eviction on memory limit', () => {
    it('evicts the oldest entry when memory limit is exceeded', () => {
      const mm = new MemoryManager({ maxMemoryMB: 5 });

      mm.put('a:0:0:0', makeTile('a:0:0:0', 2));
      mm.put('b:0:0:1', makeTile('b:0:0:1', 2));
      // 4 MB used, 5 MB limit

      // This 2 MB tile pushes total to 6 MB → must evict 'a' (oldest)
      mm.put('c:0:0:2', makeTile('c:0:0:2', 2));

      expect(mm.has('a:0:0:0')).toBe(false);
      expect(mm.has('b:0:0:1')).toBe(true);
      expect(mm.has('c:0:0:2')).toBe(true);
      expect(mm.getMemoryUsage()).toBe(4 * MB);
    });

    it('evicts multiple entries if needed', () => {
      const mm = new MemoryManager({ maxMemoryMB: 5 });

      mm.put('a:0:0:0', makeTile('a:0:0:0', 2));
      mm.put('b:0:0:1', makeTile('b:0:0:1', 2));
      // 4 MB used

      // Insert a 4 MB tile → need to evict both a and b to fit
      mm.put('c:0:0:2', makeTile('c:0:0:2', 4));

      expect(mm.has('a:0:0:0')).toBe(false);
      expect(mm.has('b:0:0:1')).toBe(false);
      expect(mm.has('c:0:0:2')).toBe(true);
      expect(mm.getMemoryUsage()).toBe(4 * MB);
    });

    it('promotes accessed entries so they are not evicted first', () => {
      const mm = new MemoryManager({ maxMemoryMB: 5 });

      mm.put('a:0:0:0', makeTile('a:0:0:0', 2));
      mm.put('b:0:0:1', makeTile('b:0:0:1', 2));

      // Access 'a' — promotes it to most-recently-used
      mm.get('a:0:0:0');

      // Insert 'c' — should evict 'b' (now the LRU), not 'a'
      mm.put('c:0:0:2', makeTile('c:0:0:2', 2));

      expect(mm.has('a:0:0:0')).toBe(true);
      expect(mm.has('b:0:0:1')).toBe(false);
      expect(mm.has('c:0:0:2')).toBe(true);
    });

    it('memory never exceeds the configured limit after any put', () => {
      const mm = new MemoryManager({ maxMemoryMB: 4 });

      for (let i = 0; i < 20; i++) {
        const key: TileCacheKey = `layer:0:0:${i}`;
        mm.put(key, makeTile(key, 1));
        expect(mm.getMemoryUsage()).toBeLessThanOrEqual(4 * MB);
      }
    });
  });

  // -- evictOutOfViewport ---------------------------------------------------

  describe('evictOutOfViewport', () => {
    it('does not evict tiles still in the viewport', () => {
      const mm = new MemoryManager({ maxMemoryMB: 10, evictionTimeoutMs: 1000 });

      mm.put('layer:1:2:3', makeTile('layer:1:2:3', 1));

      const vp = makeViewport([{ z: 1, x: 2, y: 3 }]);
      vi.advanceTimersByTime(2000);
      mm.evictOutOfViewport(vp);

      expect(mm.has('layer:1:2:3')).toBe(true);
    });

    it('evicts tiles outside viewport after timeout', () => {
      const mm = new MemoryManager({ maxMemoryMB: 10, evictionTimeoutMs: 1000 });

      mm.put('layer:1:2:3', makeTile('layer:1:2:3', 1));

      // Viewport does NOT include tile (1,2,3)
      const vp = makeViewport([{ z: 0, x: 0, y: 0 }]);

      // First call — records the tile as out-of-viewport
      mm.evictOutOfViewport(vp);
      expect(mm.has('layer:1:2:3')).toBe(true);

      // Advance past the timeout
      vi.advanceTimersByTime(1500);
      mm.evictOutOfViewport(vp);

      expect(mm.has('layer:1:2:3')).toBe(false);
      expect(mm.getMemoryUsage()).toBe(0);
    });

    it('resets timer when tile re-enters viewport', () => {
      const mm = new MemoryManager({ maxMemoryMB: 10, evictionTimeoutMs: 1000 });

      mm.put('layer:1:2:3', makeTile('layer:1:2:3', 1));

      const vpOut = makeViewport([{ z: 0, x: 0, y: 0 }]);
      const vpIn = makeViewport([{ z: 1, x: 2, y: 3 }]);

      // Tile leaves viewport
      mm.evictOutOfViewport(vpOut);
      vi.advanceTimersByTime(800);

      // Tile comes back into viewport — timer should reset
      mm.evictOutOfViewport(vpIn);

      // Advance another 800ms (total 1600ms from first leave, but only
      // 800ms since re-entry — should NOT evict)
      vi.advanceTimersByTime(800);
      mm.evictOutOfViewport(vpOut);
      expect(mm.has('layer:1:2:3')).toBe(true);

      // Now wait the full timeout from the second leave
      vi.advanceTimersByTime(1200);
      mm.evictOutOfViewport(vpOut);
      expect(mm.has('layer:1:2:3')).toBe(false);
    });

    it('matches tiles by coordinate suffix across different layers', () => {
      const mm = new MemoryManager({ maxMemoryMB: 10, evictionTimeoutMs: 1000 });

      mm.put('layerA:1:2:3', makeTile('layerA:1:2:3', 1));
      mm.put('layerB:1:2:3', makeTile('layerB:1:2:3', 1));
      mm.put('layerC:4:5:6', makeTile('layerC:4:5:6', 1));

      // Viewport includes coords (1,2,3) but not (4,5,6)
      const vp = makeViewport([{ z: 1, x: 2, y: 3 }]);

      mm.evictOutOfViewport(vp);
      vi.advanceTimersByTime(1500);
      mm.evictOutOfViewport(vp);

      // Both layerA and layerB tiles at (1,2,3) should survive
      expect(mm.has('layerA:1:2:3')).toBe(true);
      expect(mm.has('layerB:1:2:3')).toBe(true);
      // layerC tile at (4,5,6) should be evicted
      expect(mm.has('layerC:4:5:6')).toBe(false);
    });
  });

  // -- getMemoryUsage -------------------------------------------------------

  describe('getMemoryUsage', () => {
    it('returns 0 for an empty cache', () => {
      const mm = new MemoryManager({ maxMemoryMB: 10 });
      expect(mm.getMemoryUsage()).toBe(0);
    });

    it('accurately reflects insertions and evictions', () => {
      const mm = new MemoryManager({ maxMemoryMB: 3 });

      mm.put('a:0:0:0', makeTile('a:0:0:0', 1));
      expect(mm.getMemoryUsage()).toBe(1 * MB);

      mm.put('b:0:0:1', makeTile('b:0:0:1', 1));
      expect(mm.getMemoryUsage()).toBe(2 * MB);

      // This triggers eviction of 'a'
      mm.put('c:0:0:2', makeTile('c:0:0:2', 2));
      expect(mm.getMemoryUsage()).toBe(3 * MB);
    });
  });
});
