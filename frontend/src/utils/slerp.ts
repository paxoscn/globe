/**
 * Spherical Linear Interpolation (Slerp) for geographic coordinates.
 *
 * Converts lat/lng (degrees) to unit-sphere 3D vectors, performs slerp,
 * and converts back to lat/lng. This ensures geographic paths follow
 * great-circle arcs rather than straight lines in lat/lng space.
 *
 * Requirements: 11.5
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/**
 * Threshold below which two points are considered identical (in radians).
 * Roughly corresponds to ~0.6 m on Earth's surface.
 */
const EPSILON = 1e-8;

/**
 * Threshold for detecting near-antipodal points (π − Ω < threshold).
 */
const ANTIPODAL_THRESHOLD = 1e-6;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** 3D vector on the unit sphere. */
interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Convert geographic coordinates (degrees) to a unit-sphere 3D vector.
 *
 * Uses the standard geographic → Cartesian mapping:
 *   x = cos(lat) * cos(lng)
 *   y = sin(lat)
 *   z = cos(lat) * sin(lng)
 *
 * Note: latitude maps to elevation (y-axis), longitude maps to azimuth in xz-plane.
 */
export function latLngToVec3(latDeg: number, lngDeg: number): Vec3 {
  const lat = latDeg * DEG_TO_RAD;
  const lng = lngDeg * DEG_TO_RAD;
  return {
    x: Math.cos(lat) * Math.cos(lng),
    y: Math.sin(lat),
    z: Math.cos(lat) * Math.sin(lng),
  };
}

/**
 * Convert a unit-sphere 3D vector back to geographic coordinates (degrees).
 *
 * Returns { lat, lng } in degrees with:
 *   lat ∈ [-90, 90]
 *   lng ∈ [-180, 180]
 */
export function vec3ToLatLng(v: Vec3): { lat: number; lng: number } {
  const lat = Math.asin(clamp(v.y, -1, 1)) * RAD_TO_DEG;
  const lng = Math.atan2(v.z, v.x) * RAD_TO_DEG;
  return { lat, lng };
}

/** Clamp a value to [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Dot product of two 3D vectors. */
function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Spherical linear interpolation between two geographic coordinate pairs.
 *
 * @param lat1 - Latitude of the first point (degrees, −90 to 90).
 * @param lng1 - Longitude of the first point (degrees, −180 to 180).
 * @param lat2 - Latitude of the second point (degrees, −90 to 90).
 * @param lng2 - Longitude of the second point (degrees, −180 to 180).
 * @param t    - Interpolation parameter in [0, 1]. 0 → first point, 1 → second point.
 * @returns Interpolated { lat, lng } in degrees.
 */
export function slerpLatLng(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  t: number,
): { lat: number; lng: number } {
  // Convert to unit-sphere vectors
  const v1 = latLngToVec3(lat1, lng1);
  const v2 = latLngToVec3(lat2, lng2);

  // Compute the angle Ω between the two vectors via dot product.
  // Clamp to [-1, 1] to guard against floating-point overshoot.
  const d = clamp(dot(v1, v2), -1, 1);
  const omega = Math.acos(d);

  // --- Edge case: identical (or nearly identical) points ---
  if (omega < EPSILON) {
    // Points are essentially the same; return the first point to avoid 0/0.
    return { lat: lat1, lng: lng1 };
  }

  // --- Edge case: antipodal (or nearly antipodal) points ---
  if (Math.PI - omega < ANTIPODAL_THRESHOLD) {
    // The great-circle path is undefined (infinite possible arcs).
    // Fallback: linear interpolation in lat/lng space, which produces a
    // deterministic path through a "midpoint" even though it won't be a
    // true great-circle arc.
    return {
      lat: lat1 + (lat2 - lat1) * t,
      lng: lng1 + (lng2 - lng1) * t,
    };
  }

  // --- Standard slerp formula ---
  const sinOmega = Math.sin(omega);
  const a = Math.sin((1 - t) * omega) / sinOmega;
  const b = Math.sin(t * omega) / sinOmega;

  const result: Vec3 = {
    x: a * v1.x + b * v2.x,
    y: a * v1.y + b * v2.y,
    z: a * v1.z + b * v2.z,
  };

  return vec3ToLatLng(result);
}
