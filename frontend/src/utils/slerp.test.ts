/**
 * Unit tests for Slerp interpolation on geographic coordinates.
 *
 * Validates: Requirements 11.5
 */

import { describe, it, expect } from 'vitest';
import { slerpLatLng, latLngToVec3, vec3ToLatLng } from './slerp';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Tolerance for floating-point comparisons (degrees). */
const TOLERANCE = 1e-6;

function expectClose(actual: number, expected: number, tol = TOLERANCE) {
  expect(Math.abs(actual - expected)).toBeLessThan(tol);
}

// ---------------------------------------------------------------------------
// latLngToVec3 / vec3ToLatLng round-trip
// ---------------------------------------------------------------------------

describe('latLngToVec3 / vec3ToLatLng', () => {
  it('round-trips the origin (0, 0)', () => {
    const v = latLngToVec3(0, 0);
    const { lat, lng } = vec3ToLatLng(v);
    expectClose(lat, 0);
    expectClose(lng, 0);
  });

  it('round-trips the north pole (90, 0)', () => {
    const v = latLngToVec3(90, 0);
    const { lat } = vec3ToLatLng(v);
    expectClose(lat, 90);
    // Longitude is undefined at the pole; we only check latitude.
  });

  it('round-trips the south pole (-90, 0)', () => {
    const v = latLngToVec3(-90, 0);
    const { lat } = vec3ToLatLng(v);
    expectClose(lat, -90);
  });

  it('round-trips an arbitrary point (48.8566, 2.3522)', () => {
    const v = latLngToVec3(48.8566, 2.3522);
    const { lat, lng } = vec3ToLatLng(v);
    expectClose(lat, 48.8566);
    expectClose(lng, 2.3522);
  });

  it('round-trips a negative longitude (-33.8688, 151.2093)', () => {
    const v = latLngToVec3(-33.8688, 151.2093);
    const { lat, lng } = vec3ToLatLng(v);
    expectClose(lat, -33.8688);
    expectClose(lng, 151.2093);
  });

  it('produces a unit vector', () => {
    const v = latLngToVec3(35.6762, 139.6503);
    const norm = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    expectClose(norm, 1, 1e-12);
  });
});

// ---------------------------------------------------------------------------
// slerpLatLng — boundary conditions
// ---------------------------------------------------------------------------

describe('slerpLatLng — boundary conditions', () => {
  it('returns the first point at t=0', () => {
    const { lat, lng } = slerpLatLng(48.8566, 2.3522, 40.7128, -74.006, 0);
    expectClose(lat, 48.8566);
    expectClose(lng, 2.3522);
  });

  it('returns the second point at t=1', () => {
    const { lat, lng } = slerpLatLng(48.8566, 2.3522, 40.7128, -74.006, 1);
    expectClose(lat, 40.7128);
    expectClose(lng, -74.006);
  });

  it('returns the midpoint at t=0.5 (Paris → New York)', () => {
    // The midpoint should be somewhere in the North Atlantic
    const { lat, lng } = slerpLatLng(48.8566, 2.3522, 40.7128, -74.006, 0.5);
    // Midpoint latitude should be between the two (and slightly higher due to great-circle curvature)
    expect(lat).toBeGreaterThan(40);
    expect(lat).toBeLessThan(55);
    // Midpoint longitude should be between the two
    expect(lng).toBeGreaterThan(-74);
    expect(lng).toBeLessThan(3);
  });
});

// ---------------------------------------------------------------------------
// slerpLatLng — edge cases
// ---------------------------------------------------------------------------

describe('slerpLatLng — edge cases', () => {
  it('handles identical points', () => {
    const { lat, lng } = slerpLatLng(10, 20, 10, 20, 0.5);
    expectClose(lat, 10);
    expectClose(lng, 20);
  });

  it('handles identical points at any t value', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const { lat, lng } = slerpLatLng(35, -120, 35, -120, t);
      expectClose(lat, 35);
      expectClose(lng, -120);
    }
  });

  it('handles antipodal points without throwing', () => {
    // (0, 0) and (0, 180) are antipodal
    const { lat, lng } = slerpLatLng(0, 0, 0, 180, 0.5);
    // Should return a valid coordinate
    expect(lat).toBeGreaterThanOrEqual(-90);
    expect(lat).toBeLessThanOrEqual(90);
    expect(lng).toBeGreaterThanOrEqual(-180);
    expect(lng).toBeLessThanOrEqual(180);
  });

  it('handles near-antipodal points (north pole to south pole)', () => {
    const { lat, lng } = slerpLatLng(90, 0, -90, 0, 0.5);
    // Should return a valid coordinate
    expect(lat).toBeGreaterThanOrEqual(-90);
    expect(lat).toBeLessThanOrEqual(90);
    expect(lng).toBeGreaterThanOrEqual(-180);
    expect(lng).toBeLessThanOrEqual(180);
  });

  it('returns first point at t=0 for antipodal points', () => {
    const { lat, lng } = slerpLatLng(0, 0, 0, 180, 0);
    expectClose(lat, 0);
    expectClose(lng, 0);
  });

  it('returns second point at t=1 for antipodal points', () => {
    const { lat, lng } = slerpLatLng(0, 0, 0, 180, 1);
    expectClose(lat, 0);
    expectClose(lng, 180);
  });
});

// ---------------------------------------------------------------------------
// slerpLatLng — interpolation properties
// ---------------------------------------------------------------------------

describe('slerpLatLng — interpolation properties', () => {
  it('produces valid geographic coordinates for all t values', () => {
    const steps = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    for (const t of steps) {
      const { lat, lng } = slerpLatLng(48.8566, 2.3522, -33.8688, 151.2093, t);
      expect(lat).toBeGreaterThanOrEqual(-90);
      expect(lat).toBeLessThanOrEqual(90);
      expect(lng).toBeGreaterThanOrEqual(-180);
      expect(lng).toBeLessThanOrEqual(180);
    }
  });

  it('interpolation is monotonic in distance from start', () => {
    // For a simple case (same hemisphere, moderate distance), the distance
    // from the start point should increase monotonically with t.
    const lat1 = 48.8566, lng1 = 2.3522;   // Paris
    const lat2 = 40.7128, lng2 = -74.006;   // New York

    let prevDist = 0;
    for (let t = 0.1; t <= 1.0; t += 0.1) {
      const { lat, lng } = slerpLatLng(lat1, lng1, lat2, lng2, t);
      const v1 = latLngToVec3(lat1, lng1);
      const vt = latLngToVec3(lat, lng);
      const dist = Math.acos(
        Math.max(-1, Math.min(1, v1.x * vt.x + v1.y * vt.y + v1.z * vt.z)),
      );
      expect(dist).toBeGreaterThanOrEqual(prevDist - 1e-10);
      prevDist = dist;
    }
  });

  it('result lies on the great circle arc between the two points', () => {
    // For a point on the great circle, the sum of angular distances
    // from v1→vt and vt→v2 should equal the total angular distance v1→v2.
    const lat1 = 48.8566, lng1 = 2.3522;
    const lat2 = 35.6762, lng2 = 139.6503;

    const v1 = latLngToVec3(lat1, lng1);
    const v2 = latLngToVec3(lat2, lng2);
    const totalDist = Math.acos(
      Math.max(-1, Math.min(1, v1.x * v2.x + v1.y * v2.y + v1.z * v2.z)),
    );

    for (const t of [0.25, 0.5, 0.75]) {
      const { lat, lng } = slerpLatLng(lat1, lng1, lat2, lng2, t);
      const vt = latLngToVec3(lat, lng);

      const d1 = Math.acos(
        Math.max(-1, Math.min(1, v1.x * vt.x + v1.y * vt.y + v1.z * vt.z)),
      );
      const d2 = Math.acos(
        Math.max(-1, Math.min(1, vt.x * v2.x + vt.y * v2.y + vt.z * v2.z)),
      );

      // d1 + d2 should equal totalDist (within floating-point tolerance)
      expectClose(d1 + d2, totalDist, 1e-10);
    }
  });
});
