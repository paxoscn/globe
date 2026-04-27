/**
 * Viewport-to-tiles calculation.
 *
 * Given a quaternion orientation and zoom level, computes the set of visible
 * tile coordinates (z/x/y) that cover the visible hemisphere of the globe.
 *
 * The globe is viewed from a fixed camera looking at the origin. The quaternion
 * rotates the globe, so the visible hemisphere center shifts accordingly.
 *
 * Approach:
 * 1. Derive the center lat/lng from the inverse of the quaternion rotation
 *    (the camera looks down -Z, so the visible center on the unrotated globe
 *    is (0, 0, 1); rotating by the inverse quaternion gives the actual center).
 * 2. Map the zoom level to a tile z-level that determines grid resolution.
 * 3. Enumerate all tiles at that z-level and include those whose center is
 *    within a visibility angular radius from the viewport center.
 *
 * Requirements: 6.1
 */

import type { Quaternion, TileCoord } from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Degrees-to-radians conversion factor. */
const DEG2RAD = Math.PI / 180;

/** Radians-to-degrees conversion factor. */
const RAD2DEG = 180 / Math.PI;

/**
 * Angular radius (in radians) of the visible hemisphere from the camera.
 * Slightly over 90° to ensure full coverage at tile boundaries.
 */
const VISIBLE_HALF_ANGLE = (90 + 5) * DEG2RAD;

// ---------------------------------------------------------------------------
// Zoom-to-tile-z mapping
// ---------------------------------------------------------------------------

/**
 * Map a continuous zoom level to the integer tile z-level.
 *
 * This determines the grid resolution for tile enumeration.
 * Low zoom → fewer, larger tiles; high zoom → more, smaller tiles.
 *
 * | Zoom range | Tile z-level | Grid size |
 * |------------|-------------|-----------|
 * | < 2        | 1           | 2×1       |
 * | 2–3.5      | 2           | 4×2       |
 * | 3.5–5      | 3           | 8×4       |
 * | 5–7        | 4           | 16×8      |
 * | ≥ 7        | 5           | 32×16     |
 */
export function zoomToTileZ(zoom: number): number {
  if (Number.isNaN(zoom) || zoom < 2) return 1;
  if (zoom < 3.5) return 2;
  if (zoom < 5) return 3;
  if (zoom < 7) return 4;
  return 5;
}

// ---------------------------------------------------------------------------
// Quaternion helpers
// ---------------------------------------------------------------------------

/**
 * Rotate a 3D vector by a quaternion.
 *
 * Uses the formula: v' = q * v * q⁻¹
 * For unit quaternions, q⁻¹ = conjugate(q).
 */
export function rotateVector(
  q: Quaternion,
  vx: number,
  vy: number,
  vz: number,
): [number, number, number] {
  // q * v (treating v as quaternion (vx, vy, vz, 0))
  const tx = q.w * vx + q.y * vz - q.z * vy;
  const ty = q.w * vy + q.z * vx - q.x * vz;
  const tz = q.w * vz + q.x * vy - q.y * vx;
  const tw = -(q.x * vx + q.y * vy + q.z * vz);

  // (q * v) * q⁻¹  where q⁻¹ = (-qx, -qy, -qz, qw) for unit quaternion
  const rx = tx * q.w - tw * q.x - ty * q.z + tz * q.y;
  const ry = ty * q.w - tw * q.y - tz * q.x + tx * q.z;
  const rz = tz * q.w - tw * q.z - tx * q.y + ty * q.x;

  return [rx, ry, rz];
}

/**
 * Compute the conjugate (inverse for unit quaternions) of a quaternion.
 */
export function quaternionConjugate(q: Quaternion): Quaternion {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

// ---------------------------------------------------------------------------
// Coordinate conversions
// ---------------------------------------------------------------------------

/**
 * Convert latitude/longitude (in radians) to a unit 3D vector.
 */
export function latLngToVector(
  latRad: number,
  lngRad: number,
): [number, number, number] {
  const cosLat = Math.cos(latRad);
  return [cosLat * Math.cos(lngRad), Math.sin(latRad), cosLat * Math.sin(lngRad)];
}

/**
 * Convert a 3D unit vector to latitude/longitude in degrees.
 */
export function vectorToLatLngDeg(
  x: number,
  y: number,
  z: number,
): { lat: number; lng: number } {
  const lat = Math.asin(Math.max(-1, Math.min(1, y))) * RAD2DEG;
  const lng = Math.atan2(z, x) * RAD2DEG;
  return { lat, lng };
}

// ---------------------------------------------------------------------------
// Tile coordinate helpers
// ---------------------------------------------------------------------------

/**
 * Convert tile (z, x, y) to the latitude/longitude of its center in radians.
 *
 * Uses the standard Web Mercator tiling scheme (Slippy map convention):
 * - x ranges from 0 to 2^z - 1 (left to right, -180° to +180°)
 * - y ranges from 0 to 2^z - 1 (top to bottom, +85.05° to -85.05°)
 */
export function tileCenterLatLng(
  z: number,
  x: number,
  y: number,
): { latRad: number; lngRad: number } {
  const n = 1 << z; // 2^z
  const lngDeg = ((x + 0.5) / n) * 360 - 180;
  // Inverse Mercator for latitude
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / n)));
  return { latRad, lngRad: lngDeg * DEG2RAD };
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Compute the set of visible tile coordinates for a given viewport.
 *
 * @param quaternion - Globe orientation as a unit quaternion.
 * @param zoom - Current zoom level.
 * @returns Array of TileCoord objects covering the visible area.
 */
export function computeVisibleTiles(
  quaternion: Quaternion,
  zoom: number,
): TileCoord[] {
  const tileZ = zoomToTileZ(zoom);
  const n = 1 << tileZ; // number of tiles per axis at this z-level

  // The camera looks down the -Z axis in world space. On the unrotated globe,
  // the point facing the camera is (0, 0, 1) in the globe's local frame
  // (since the globe's +Z faces the camera before any rotation).
  //
  // When the globe is rotated by quaternion q, the point that was at (0, 0, 1)
  // moves to q * (0,0,1) * q⁻¹. But we want the geographic point now facing
  // the camera, which is the inverse: q⁻¹ * (0,0,1) * q, i.e. rotate (0,0,1)
  // by the conjugate quaternion.
  const qInv = quaternionConjugate(quaternion);
  const [cx, cy, cz] = rotateVector(qInv, 0, 0, 1);

  // Convert center vector to lat/lng for reference (not strictly needed for
  // the dot-product visibility test, but useful for debugging).
  // The center direction on the unit sphere:
  const centerLen = Math.sqrt(cx * cx + cy * cy + cz * cz);
  const ncx = cx / centerLen;
  const ncy = cy / centerLen;
  const ncz = cz / centerLen;

  const cosThreshold = Math.cos(VISIBLE_HALF_ANGLE);

  const tiles: TileCoord[] = [];

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const { latRad, lngRad } = tileCenterLatLng(tileZ, x, y);
      const [tx, ty, tz] = latLngToVector(latRad, lngRad);

      // Dot product between tile center direction and viewport center direction.
      // If dot >= cos(threshold), the tile center is within the visible cone.
      const dot = tx * ncx + ty * ncy + tz * ncz;

      if (dot >= cosThreshold) {
        tiles.push({ z: tileZ, x, y });
      }
    }
  }

  return tiles;
}
