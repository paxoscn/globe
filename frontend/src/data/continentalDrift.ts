/**
 * Continental drift simulation data.
 *
 * Defines keyframe positions for each major landmass at geological time
 * points, from ~300 Ma (Pangaea) through breakup stages to the present.
 * Each continent's outline is offset (translated) from its present-day
 * position using simplified plate-tectonic reconstructions.
 *
 * Time is measured in Ma (millions of years ago). 0 Ma = present day.
 *
 * The drift is modeled as a per-continent (lng, lat) offset at each
 * keyframe. Between keyframes we linearly interpolate the offset, then
 * apply it to every coordinate of the continent's present-day outline.
 *
 * Sources (simplified/approximated for visualization):
 * - Scotese, C.R. PALEOMAP Project
 * - Torsvik & Cocks, Earth History and Palaeogeography (2017)
 */

import type { FeatureCollection, Feature } from '../types/geojson';
import { MOCK_GEOJSON } from './mockLayers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DriftKeyframe {
  /** Time in Ma (millions of years ago). 0 = present. */
  ma: number;
  /** Longitude offset in degrees to add to present-day coordinates. */
  dLng: number;
  /** Latitude offset in degrees to add to present-day coordinates. */
  dLat: number;
  /** Optional rotation in degrees (clockwise). */
  rotation?: number;
}

export interface ContinentDriftData {
  /** Name matching the feature property `name` in world-borders GeoJSON. */
  name: string;
  /** Keyframes sorted from oldest (highest Ma) to present (0 Ma). */
  keyframes: DriftKeyframe[];
}

// ---------------------------------------------------------------------------
// Time range
// ---------------------------------------------------------------------------

/** Oldest time point in the simulation (Ma). */
export const DRIFT_MAX_MA = 300;
/** Present day. */
export const DRIFT_MIN_MA = 0;

// ---------------------------------------------------------------------------
// Per-continent drift keyframes
//
// Offsets are relative to present-day positions. At 0 Ma all offsets are 0.
// At 300 Ma the continents are clustered into Pangaea configuration.
//
// The keyframes are rough approximations for visual effect — not precise
// paleogeographic reconstructions.
// ---------------------------------------------------------------------------

export const CONTINENT_DRIFT: ContinentDriftData[] = [
  {
    name: 'North America',
    keyframes: [
      { ma: 300, dLng: 50,  dLat: -25, rotation: 15 },
      { ma: 250, dLng: 45,  dLat: -22, rotation: 12 },
      { ma: 200, dLng: 35,  dLat: -18, rotation: 8 },
      { ma: 150, dLng: 22,  dLat: -12, rotation: 5 },
      { ma: 100, dLng: 12,  dLat: -6,  rotation: 2 },
      { ma: 50,  dLng: 5,   dLat: -2,  rotation: 1 },
      { ma: 0,   dLng: 0,   dLat: 0,   rotation: 0 },
    ],
  },
  {
    name: 'South America',
    keyframes: [
      { ma: 300, dLng: 35,  dLat: -10, rotation: -30 },
      { ma: 250, dLng: 32,  dLat: -8,  rotation: -25 },
      { ma: 200, dLng: 25,  dLat: -5,  rotation: -18 },
      { ma: 150, dLng: 15,  dLat: -3,  rotation: -10 },
      { ma: 100, dLng: 5,   dLat: -1,  rotation: -4 },
      { ma: 50,  dLng: 2,   dLat: 0,   rotation: -1 },
      { ma: 0,   dLng: 0,   dLat: 0,   rotation: 0 },
    ],
  },
  {
    name: 'Europe',
    keyframes: [
      { ma: 300, dLng: -10, dLat: -30, rotation: -20 },
      { ma: 250, dLng: -8,  dLat: -26, rotation: -16 },
      { ma: 200, dLng: -5,  dLat: -20, rotation: -10 },
      { ma: 150, dLng: -3,  dLat: -14, rotation: -6 },
      { ma: 100, dLng: -2,  dLat: -8,  rotation: -3 },
      { ma: 50,  dLng: -1,  dLat: -3,  rotation: -1 },
      { ma: 0,   dLng: 0,   dLat: 0,   rotation: 0 },
    ],
  },
  {
    name: 'Africa',
    keyframes: [
      { ma: 300, dLng: 10,  dLat: -20, rotation: -25 },
      { ma: 250, dLng: 8,   dLat: -17, rotation: -20 },
      { ma: 200, dLng: 5,   dLat: -12, rotation: -14 },
      { ma: 150, dLng: 3,   dLat: -8,  rotation: -8 },
      { ma: 100, dLng: 1,   dLat: -4,  rotation: -3 },
      { ma: 50,  dLng: 0,   dLat: -1,  rotation: -1 },
      { ma: 0,   dLng: 0,   dLat: 0,   rotation: 0 },
    ],
  },
  {
    name: 'Asia',
    keyframes: [
      { ma: 300, dLng: -25, dLat: -30, rotation: -15 },
      { ma: 250, dLng: -20, dLat: -25, rotation: -12 },
      { ma: 200, dLng: -15, dLat: -18, rotation: -8 },
      { ma: 150, dLng: -10, dLat: -12, rotation: -5 },
      { ma: 100, dLng: -5,  dLat: -6,  rotation: -2 },
      { ma: 50,  dLng: -2,  dLat: -2,  rotation: -1 },
      { ma: 0,   dLng: 0,   dLat: 0,   rotation: 0 },
    ],
  },
  {
    name: 'Australia',
    keyframes: [
      { ma: 300, dLng: -30, dLat: -30, rotation: 40 },
      { ma: 250, dLng: -28, dLat: -28, rotation: 35 },
      { ma: 200, dLng: -25, dLat: -25, rotation: 28 },
      { ma: 150, dLng: -20, dLat: -22, rotation: 22 },
      { ma: 100, dLng: -12, dLat: -18, rotation: 15 },
      { ma: 50,  dLng: -5,  dLat: -8,  rotation: 6 },
      { ma: 0,   dLng: 0,   dLat: 0,   rotation: 0 },
    ],
  },
  {
    name: 'Japan',
    keyframes: [
      { ma: 300, dLng: -30, dLat: -25, rotation: -10 },
      { ma: 250, dLng: -25, dLat: -20, rotation: -8 },
      { ma: 200, dLng: -18, dLat: -15, rotation: -5 },
      { ma: 150, dLng: -12, dLat: -10, rotation: -3 },
      { ma: 100, dLng: -6,  dLat: -5,  rotation: -1 },
      { ma: 50,  dLng: -2,  dLat: -2,  rotation: 0 },
      { ma: 0,   dLng: 0,   dLat: 0,   rotation: 0 },
    ],
  },
  {
    name: 'British Isles',
    keyframes: [
      { ma: 300, dLng: -5,  dLat: -32, rotation: -15 },
      { ma: 250, dLng: -4,  dLat: -28, rotation: -12 },
      { ma: 200, dLng: -3,  dLat: -22, rotation: -8 },
      { ma: 150, dLng: -2,  dLat: -15, rotation: -5 },
      { ma: 100, dLng: -1,  dLat: -8,  rotation: -2 },
      { ma: 50,  dLng: 0,   dLat: -3,  rotation: -1 },
      { ma: 0,   dLng: 0,   dLat: 0,   rotation: 0 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Interpolation
// ---------------------------------------------------------------------------

/**
 * Interpolate the drift offset for a continent at a given time (Ma).
 */
function interpolateOffset(
  keyframes: DriftKeyframe[],
  ma: number,
): { dLng: number; dLat: number; rotation: number } {
  // Clamp
  if (ma >= keyframes[0].ma) {
    return {
      dLng: keyframes[0].dLng,
      dLat: keyframes[0].dLat,
      rotation: keyframes[0].rotation ?? 0,
    };
  }
  if (ma <= keyframes[keyframes.length - 1].ma) {
    const last = keyframes[keyframes.length - 1];
    return { dLng: last.dLng, dLat: last.dLat, rotation: last.rotation ?? 0 };
  }

  // Find surrounding keyframes (keyframes sorted oldest→newest, i.e. 300→0)
  let i = 0;
  for (; i < keyframes.length - 1; i++) {
    if (ma <= keyframes[i].ma && ma >= keyframes[i + 1].ma) break;
  }

  const a = keyframes[i];
  const b = keyframes[i + 1];
  const t = (a.ma - ma) / (a.ma - b.ma); // 0 at a, 1 at b

  return {
    dLng: a.dLng + (b.dLng - a.dLng) * t,
    dLat: a.dLat + (b.dLat - a.dLat) * t,
    rotation: (a.rotation ?? 0) + ((b.rotation ?? 0) - (a.rotation ?? 0)) * t,
  };
}

/**
 * Rotate a [lng, lat] coordinate around a center point by `degrees`.
 * This is a simple 2D rotation in the lng/lat plane — good enough for
 * the small rotations used in our drift simulation.
 */
function rotateCoord(
  lng: number,
  lat: number,
  centerLng: number,
  centerLat: number,
  degrees: number,
): [number, number] {
  if (Math.abs(degrees) < 0.001) return [lng, lat];
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = lng - centerLng;
  const dy = lat - centerLat;
  return [
    centerLng + dx * cos - dy * sin,
    centerLat + dx * sin + dy * cos,
  ];
}

/**
 * Compute the centroid of a coordinate ring (for rotation center).
 */
function centroid(coords: [number, number][]): [number, number] {
  let sumLng = 0;
  let sumLat = 0;
  for (const [lng, lat] of coords) {
    sumLng += lng;
    sumLat += lat;
  }
  return [sumLng / coords.length, sumLat / coords.length];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Geological era info for display. */
export interface GeoEra {
  name: string;
  nameEn: string;
  startMa: number;
  endMa: number;
  color: string;
}

export const GEO_ERAS: GeoEra[] = [
  { name: '二叠纪', nameEn: 'Permian',    startMa: 300, endMa: 252, color: '#f97316' },
  { name: '三叠纪', nameEn: 'Triassic',   startMa: 252, endMa: 201, color: '#a855f7' },
  { name: '侏罗纪', nameEn: 'Jurassic',   startMa: 201, endMa: 145, color: '#3b82f6' },
  { name: '白垩纪', nameEn: 'Cretaceous', startMa: 145, endMa: 66,  color: '#22c55e' },
  { name: '古近纪', nameEn: 'Paleogene',  startMa: 66,  endMa: 23,  color: '#eab308' },
  { name: '新近纪', nameEn: 'Neogene',    startMa: 23,  endMa: 2.6, color: '#f59e0b' },
  { name: '第四纪', nameEn: 'Quaternary', startMa: 2.6, endMa: 0,   color: '#06b6d4' },
];

/**
 * Get the geological era for a given time (Ma).
 */
export function getEraForTime(ma: number): GeoEra {
  for (const era of GEO_ERAS) {
    if (ma >= era.endMa && ma <= era.startMa) return era;
  }
  return GEO_ERAS[GEO_ERAS.length - 1];
}

/**
 * Generate a FeatureCollection with continent outlines shifted to their
 * positions at the given geological time (Ma).
 *
 * @param ma  Time in millions of years ago (0 = present, 300 = Pangaea)
 * @returns   A new FeatureCollection with shifted coordinates
 */
export function interpolateContinents(ma: number): FeatureCollection {
  const presentDay = MOCK_GEOJSON['world-borders'];
  if (!presentDay) {
    return { type: 'FeatureCollection', features: [] };
  }

  // Build a lookup: continent name → drift data
  const driftMap = new Map<string, ContinentDriftData>();
  for (const cd of CONTINENT_DRIFT) {
    driftMap.set(cd.name, cd);
  }

  const features: Feature[] = presentDay.features.map((feature) => {
    const name = (feature.properties as Record<string, unknown>)?.name as string | undefined;
    const drift = name ? driftMap.get(name) : undefined;

    if (!drift || feature.geometry.type !== 'LineString') {
      // No drift data or unsupported geometry — return as-is
      return feature;
    }

    const offset = interpolateOffset(drift.keyframes, ma);
    const coords = feature.geometry.coordinates as [number, number][];
    const center = centroid(coords);

    const shifted = coords.map(([lng, lat]) => {
      // Apply rotation first (around the continent's centroid)
      const [rLng, rLat] = rotateCoord(lng, lat, center[0], center[1], offset.rotation);
      // Then translate
      return [rLng + offset.dLng, rLat + offset.dLat] as [number, number];
    });

    return {
      ...feature,
      geometry: {
        type: 'LineString' as const,
        coordinates: shifted,
      },
    };
  });

  return { type: 'FeatureCollection', features };
}
