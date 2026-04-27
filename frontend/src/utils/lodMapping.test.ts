import { describe, it, expect } from 'vitest';
import { zoomToLod, LOD_MIN, LOD_MAX } from './lodMapping';

describe('zoomToLod', () => {
  // -------------------------------------------------------------------
  // Exact bracket boundaries
  // -------------------------------------------------------------------

  it('maps z=0 to LOD 0', () => {
    expect(zoomToLod(0)).toBe(0);
  });

  it('maps z=3 to LOD 0', () => {
    expect(zoomToLod(3)).toBe(0);
  });

  it('maps z=4 to LOD 1', () => {
    expect(zoomToLod(4)).toBe(1);
  });

  it('maps z=6 to LOD 1', () => {
    expect(zoomToLod(6)).toBe(1);
  });

  it('maps z=7 to LOD 2', () => {
    expect(zoomToLod(7)).toBe(2);
  });

  it('maps z=10 to LOD 2', () => {
    expect(zoomToLod(10)).toBe(2);
  });

  // -------------------------------------------------------------------
  // Fractional zoom values (smooth zoom produces non-integer values)
  // -------------------------------------------------------------------

  it('maps z=3.5 to LOD 0', () => {
    expect(zoomToLod(3.5)).toBe(0);
  });

  it('maps z=3.99 to LOD 0', () => {
    expect(zoomToLod(3.99)).toBe(0);
  });

  it('maps z=4.0 to LOD 1', () => {
    expect(zoomToLod(4.0)).toBe(1);
  });

  it('maps z=6.99 to LOD 1', () => {
    expect(zoomToLod(6.99)).toBe(1);
  });

  it('maps z=7.0 to LOD 2', () => {
    expect(zoomToLod(7.0)).toBe(2);
  });

  // -------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------

  it('maps negative zoom to LOD 0', () => {
    expect(zoomToLod(-1)).toBe(0);
    expect(zoomToLod(-100)).toBe(0);
  });

  it('maps very large zoom to LOD 2', () => {
    expect(zoomToLod(100)).toBe(2);
    expect(zoomToLod(1_000_000)).toBe(2);
  });

  it('maps NaN to LOD 0', () => {
    expect(zoomToLod(NaN)).toBe(0);
  });

  it('maps Infinity to LOD 2', () => {
    expect(zoomToLod(Infinity)).toBe(2);
  });

  it('maps -Infinity to LOD 0', () => {
    expect(zoomToLod(-Infinity)).toBe(0);
  });

  // -------------------------------------------------------------------
  // Monotonically non-decreasing property (spot check)
  // -------------------------------------------------------------------

  it('is monotonically non-decreasing across integer zoom levels 0–10', () => {
    let prevLod = zoomToLod(0);
    for (let z = 1; z <= 10; z++) {
      const lod = zoomToLod(z);
      expect(lod).toBeGreaterThanOrEqual(prevLod);
      prevLod = lod;
    }
  });

  // -------------------------------------------------------------------
  // Output range
  // -------------------------------------------------------------------

  it('always returns a value between LOD_MIN and LOD_MAX', () => {
    const testValues = [-10, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100];
    for (const z of testValues) {
      const lod = zoomToLod(z);
      expect(lod).toBeGreaterThanOrEqual(LOD_MIN);
      expect(lod).toBeLessThanOrEqual(LOD_MAX);
    }
  });
});
