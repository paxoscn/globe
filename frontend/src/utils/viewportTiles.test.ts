import { describe, it, expect } from 'vitest';
import {
  computeVisibleTiles,
  zoomToTileZ,
  rotateVector,
  quaternionConjugate,
  latLngToVector,
  vectorToLatLngDeg,
  tileCenterLatLng,
} from './viewportTiles';
import type { Quaternion } from '../types';

// ---------------------------------------------------------------------------
// Helper: identity quaternion (no rotation)
// ---------------------------------------------------------------------------
const IDENTITY_Q: Quaternion = { x: 0, y: 0, z: 0, w: 1 };

/**
 * Build a quaternion from axis-angle representation.
 * axis must be a unit vector.
 */
function axisAngleQuat(
  ax: number,
  ay: number,
  az: number,
  angleDeg: number,
): Quaternion {
  const half = (angleDeg * Math.PI) / 360; // half angle in radians
  const s = Math.sin(half);
  return { x: ax * s, y: ay * s, z: az * s, w: Math.cos(half) };
}

// ---------------------------------------------------------------------------
// zoomToTileZ
// ---------------------------------------------------------------------------

describe('zoomToTileZ', () => {
  it('maps low zoom to tile z=1', () => {
    expect(zoomToTileZ(1)).toBe(1);
    expect(zoomToTileZ(0)).toBe(1);
    expect(zoomToTileZ(-5)).toBe(1);
  });

  it('maps zoom 2–3.5 to tile z=2', () => {
    expect(zoomToTileZ(2)).toBe(2);
    expect(zoomToTileZ(3)).toBe(2);
    expect(zoomToTileZ(3.4)).toBe(2);
  });

  it('maps zoom 3.5–5 to tile z=3', () => {
    expect(zoomToTileZ(3.5)).toBe(3);
    expect(zoomToTileZ(4.9)).toBe(3);
  });

  it('maps zoom 5–7 to tile z=4', () => {
    expect(zoomToTileZ(5)).toBe(4);
    expect(zoomToTileZ(6.9)).toBe(4);
  });

  it('maps zoom ≥7 to tile z=5', () => {
    expect(zoomToTileZ(7)).toBe(5);
    expect(zoomToTileZ(10)).toBe(5);
    expect(zoomToTileZ(100)).toBe(5);
  });

  it('handles NaN as low zoom', () => {
    expect(zoomToTileZ(NaN)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// quaternionConjugate
// ---------------------------------------------------------------------------

describe('quaternionConjugate', () => {
  it('negates x, y, z and keeps w', () => {
    const q: Quaternion = { x: 1, y: 2, z: 3, w: 4 };
    const c = quaternionConjugate(q);
    expect(c).toEqual({ x: -1, y: -2, z: -3, w: 4 });
  });

  it('conjugate of identity is functionally identity', () => {
    const c = quaternionConjugate(IDENTITY_Q);
    expect(c.x).toBeCloseTo(0, 10);
    expect(c.y).toBeCloseTo(0, 10);
    expect(c.z).toBeCloseTo(0, 10);
    expect(c.w).toBeCloseTo(1, 10);
  });
});

// ---------------------------------------------------------------------------
// rotateVector
// ---------------------------------------------------------------------------

describe('rotateVector', () => {
  it('identity quaternion leaves vector unchanged', () => {
    const [rx, ry, rz] = rotateVector(IDENTITY_Q, 1, 0, 0);
    expect(rx).toBeCloseTo(1, 10);
    expect(ry).toBeCloseTo(0, 10);
    expect(rz).toBeCloseTo(0, 10);
  });

  it('90° rotation around Y axis rotates (0,0,1) to (1,0,0)', () => {
    const q = axisAngleQuat(0, 1, 0, 90);
    const [rx, ry, rz] = rotateVector(q, 0, 0, 1);
    expect(rx).toBeCloseTo(1, 5);
    expect(ry).toBeCloseTo(0, 5);
    expect(rz).toBeCloseTo(0, 5);
  });

  it('180° rotation around Y axis rotates (0,0,1) to (0,0,-1)', () => {
    const q = axisAngleQuat(0, 1, 0, 180);
    const [rx, ry, rz] = rotateVector(q, 0, 0, 1);
    expect(rx).toBeCloseTo(0, 5);
    expect(ry).toBeCloseTo(0, 5);
    expect(rz).toBeCloseTo(-1, 5);
  });
});

// ---------------------------------------------------------------------------
// latLngToVector / vectorToLatLngDeg round-trip
// ---------------------------------------------------------------------------

describe('latLngToVector / vectorToLatLngDeg', () => {
  it('round-trips (0, 0) — equator, prime meridian', () => {
    const [x, y, z] = latLngToVector(0, 0);
    const { lat, lng } = vectorToLatLngDeg(x, y, z);
    expect(lat).toBeCloseTo(0, 5);
    expect(lng).toBeCloseTo(0, 5);
  });

  it('round-trips north pole (90°, 0°)', () => {
    const latRad = (90 * Math.PI) / 180;
    const [x, y, z] = latLngToVector(latRad, 0);
    const { lat } = vectorToLatLngDeg(x, y, z);
    expect(lat).toBeCloseTo(90, 5);
  });

  it('round-trips arbitrary point (45°, -90°)', () => {
    const latRad = (45 * Math.PI) / 180;
    const lngRad = (-90 * Math.PI) / 180;
    const [x, y, z] = latLngToVector(latRad, lngRad);
    const { lat, lng } = vectorToLatLngDeg(x, y, z);
    expect(lat).toBeCloseTo(45, 5);
    expect(lng).toBeCloseTo(-90, 5);
  });
});

// ---------------------------------------------------------------------------
// tileCenterLatLng
// ---------------------------------------------------------------------------

describe('tileCenterLatLng', () => {
  it('z=1 tile (0,0) center is in the NW quadrant', () => {
    const { latRad, lngRad } = tileCenterLatLng(1, 0, 0);
    const latDeg = (latRad * 180) / Math.PI;
    const lngDeg = (lngRad * 180) / Math.PI;
    // x=0 of 2 tiles → center at -90° lng
    expect(lngDeg).toBeCloseTo(-90, 1);
    // y=0 of 2 tiles → northern hemisphere
    expect(latDeg).toBeGreaterThan(0);
  });

  it('z=1 tile (1,1) center is in the SE quadrant', () => {
    const { latRad, lngRad } = tileCenterLatLng(1, 1, 1);
    const latDeg = (latRad * 180) / Math.PI;
    const lngDeg = (lngRad * 180) / Math.PI;
    expect(lngDeg).toBeCloseTo(90, 1);
    expect(latDeg).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// computeVisibleTiles
// ---------------------------------------------------------------------------

describe('computeVisibleTiles', () => {
  it('returns tiles for identity quaternion (camera facing +Z on globe)', () => {
    const tiles = computeVisibleTiles(IDENTITY_Q, 1);
    expect(tiles.length).toBeGreaterThan(0);
    // All tiles should have z matching the tile z-level for zoom=1
    for (const t of tiles) {
      expect(t.z).toBe(1);
    }
  });

  it('returns roughly half the tiles at z=1 (visible hemisphere)', () => {
    // At z=1 there are 2×2 = 4 tiles. The visible hemisphere should include
    // about half, but with the 5° margin we may get 2-3 tiles.
    const tiles = computeVisibleTiles(IDENTITY_Q, 1);
    expect(tiles.length).toBeGreaterThanOrEqual(1);
    expect(tiles.length).toBeLessThanOrEqual(4);
  });

  it('returns tiles at higher z-level for higher zoom', () => {
    const tilesLow = computeVisibleTiles(IDENTITY_Q, 1);
    const tilesHigh = computeVisibleTiles(IDENTITY_Q, 5);
    // Higher zoom → higher tile z → more tiles
    expect(tilesHigh[0].z).toBeGreaterThan(tilesLow[0].z);
  });

  it('different quaternion orientations produce different tile sets', () => {
    // Rotate 90° around Y axis — should shift visible tiles
    const q90 = axisAngleQuat(0, 1, 0, 90);
    const tilesDefault = computeVisibleTiles(IDENTITY_Q, 2);
    const tilesRotated = computeVisibleTiles(q90, 2);

    // The tile sets should differ (different hemispheres visible)
    const defaultKeys = new Set(tilesDefault.map((t) => `${t.x},${t.y}`));
    const rotatedKeys = new Set(tilesRotated.map((t) => `${t.x},${t.y}`));

    // They shouldn't be identical
    const overlap = [...defaultKeys].filter((k) => rotatedKeys.has(k));
    expect(overlap.length).toBeLessThan(defaultKeys.size);
  });

  it('180° rotation shows the opposite hemisphere', () => {
    const q180 = axisAngleQuat(0, 1, 0, 180);
    const tilesDefault = computeVisibleTiles(IDENTITY_Q, 2);
    const tilesOpposite = computeVisibleTiles(q180, 2);

    // With z=2 (4×4 grid), the two hemispheres should have mostly different tiles
    const defaultKeys = new Set(tilesDefault.map((t) => `${t.x},${t.y}`));
    const oppositeKeys = new Set(tilesOpposite.map((t) => `${t.x},${t.y}`));

    // Some overlap is expected at the boundary, but most should differ
    const uniqueToDefault = [...defaultKeys].filter((k) => !oppositeKeys.has(k));
    expect(uniqueToDefault.length).toBeGreaterThan(0);
  });

  it('covers the visible area — tiles near the center are always included', () => {
    // For identity quaternion, the center is at (0°, 0°) in our coordinate system.
    // The tile containing that point should be in the result.
    const tiles = computeVisibleTiles(IDENTITY_Q, 3);
    const tileZ = 3;
    const n = 1 << tileZ; // 8

    // The center (lat=0, lng=0) maps to tile x ≈ n/2, y ≈ n/2
    // In slippy map: x = floor((lng+180)/360 * n), y ≈ n/2 for equator
    const centerX = Math.floor(((0 + 180) / 360) * n); // = 4
    const centerY = Math.floor(n / 2); // = 4

    // At least one tile near the center should be present
    const hasCenterTile = tiles.some(
      (t) => Math.abs(t.x - centerX) <= 1 && Math.abs(t.y - centerY) <= 1,
    );
    expect(hasCenterTile).toBe(true);
  });

  it('all returned tiles have valid coordinates', () => {
    const q = axisAngleQuat(1, 0, 0, 45);
    const tiles = computeVisibleTiles(q, 4);
    const tileZ = zoomToTileZ(4);
    const n = 1 << tileZ;

    for (const t of tiles) {
      expect(t.z).toBe(tileZ);
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.x).toBeLessThan(n);
      expect(t.y).toBeGreaterThanOrEqual(0);
      expect(t.y).toBeLessThan(n);
    }
  });

  it('returns no duplicate tiles', () => {
    const tiles = computeVisibleTiles(IDENTITY_Q, 3);
    const keys = tiles.map((t) => `${t.z}:${t.x}:${t.y}`);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it('returns at least 1 tile for any valid orientation', () => {
    // Test several orientations
    const orientations: Quaternion[] = [
      IDENTITY_Q,
      axisAngleQuat(0, 1, 0, 90),
      axisAngleQuat(0, 1, 0, 180),
      axisAngleQuat(1, 0, 0, 90),
      axisAngleQuat(0, 0, 1, 45),
      axisAngleQuat(
        1 / Math.sqrt(3),
        1 / Math.sqrt(3),
        1 / Math.sqrt(3),
        120,
      ),
    ];

    for (const q of orientations) {
      const tiles = computeVisibleTiles(q, 2);
      expect(tiles.length).toBeGreaterThan(0);
    }
  });
});
