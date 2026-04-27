/**
 * Zoom-to-LOD mapping utility.
 *
 * Maps the current zoom level to a Level of Detail (LOD) value used for
 * selecting the appropriate vector tile simplification level.
 *
 * LOD table (from design doc):
 *   LOD 0 (low)  — z = 0–3  — tolerance 1.0°  — global overview
 *   LOD 1 (mid)  — z = 4–6  — tolerance 0.1°  — continent / country
 *   LOD 2 (high) — z = 7+   — tolerance 0.01° — regional detail
 *
 * The mapping is monotonically non-decreasing: higher zoom always yields
 * an equal or higher LOD.
 *
 * Requirements: 3.4, 6.2, 7.1
 */

/** Minimum LOD level. */
export const LOD_MIN = 0;

/** Maximum LOD level. */
export const LOD_MAX = 2;

/**
 * Map a zoom level to the corresponding LOD level.
 *
 * @param zoom - Current zoom level (any number, including negatives).
 * @returns LOD level: 0, 1, or 2.
 *
 * Edge-case handling:
 * - Negative or very small zoom values map to LOD 0.
 * - Very large zoom values map to LOD 2.
 * - NaN maps to LOD 0 (safest fallback).
 */
export function zoomToLod(zoom: number): number {
  if (Number.isNaN(zoom)) return LOD_MIN;
  if (zoom < 4) return 0;
  if (zoom < 7) return 1;
  return 2;
}
