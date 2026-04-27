/**
 * Transition_Engine — Keyframe sequence construction and interpolation
 * for smooth object transitions within layer groups.
 *
 * This module builds keyframe sequences from object references across layers
 * in a layer group, enabling smooth interpolation as the user drags the
 * layer group slider.
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.6, 11.7
 */

import type {
  LayerGroupMeta,
  ObjectReference,
  Keyframe,
  KeyframeSequence,
  InterpolatedObject,
} from '../types';
import { slerpLatLng } from '../utils/slerp';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Map from layer ID to the array of object references in that layer.
 */
export type ObjectRefMap = Map<string, ObjectReference[]>;

// ---------------------------------------------------------------------------
// buildKeyframes
// ---------------------------------------------------------------------------

/**
 * Build keyframe sequences for every unique object across all layers in a
 * layer group.
 *
 * For each unique `objectId` found in the object references:
 *   1. Create one {@link Keyframe} per layer where the object appears,
 *      capturing the object's position and properties at that layer index.
 *   2. Order keyframes by layer index within the group.
 *   3. Track `firstIndex` (first layer where the object appears) and
 *      `lastIndex` (last layer where the object appears).
 *
 * @param group    - The layer group metadata (provides ordered layer list).
 * @param objectRefs - Map from layer ID → ObjectReference[] for that layer.
 * @returns An array of {@link KeyframeSequence}, one per unique object.
 */
export function buildKeyframes(
  group: LayerGroupMeta,
  objectRefs: ObjectRefMap,
): KeyframeSequence[] {
  // Build a lookup from layer ID → index within the group.
  const layerIndexMap = new Map<string, number>();
  for (let i = 0; i < group.layers.length; i++) {
    layerIndexMap.set(group.layers[i].id, i);
  }

  // Accumulate keyframes per object, keyed by objectId.
  const objectKeyframes = new Map<string, Keyframe[]>();

  // Iterate layers in group order so keyframes are naturally ordered.
  for (let layerIdx = 0; layerIdx < group.layers.length; layerIdx++) {
    const layer = group.layers[layerIdx];
    const refs = objectRefs.get(layer.id);
    if (!refs) continue;

    for (const ref of refs) {
      const keyframe: Keyframe = {
        layerIndex: layerIdx,
        latitude: ref.latitude,
        longitude: ref.longitude,
        properties: { ...ref.properties },
      };

      let keyframes = objectKeyframes.get(ref.objectId);
      if (!keyframes) {
        keyframes = [];
        objectKeyframes.set(ref.objectId, keyframes);
      }
      keyframes.push(keyframe);
    }
  }

  // Build the final KeyframeSequence array.
  const sequences: KeyframeSequence[] = [];

  for (const [objectId, keyframes] of objectKeyframes) {
    // Keyframes are already ordered by layer index because we iterated
    // layers in order. Sort defensively in case of duplicate layer refs.
    keyframes.sort((a, b) => a.layerIndex - b.layerIndex);

    const firstIndex = keyframes[0].layerIndex;
    const lastIndex = keyframes[keyframes.length - 1].layerIndex;

    sequences.push({
      objectId,
      keyframes,
      firstIndex,
      lastIndex,
    });
  }

  return sequences;
}

// ---------------------------------------------------------------------------
// lerpValue — Linear interpolation for numeric properties
// ---------------------------------------------------------------------------

/**
 * Linearly interpolate between two numeric values.
 *
 * At integer values of t (i.e. t === 0 or t === 1), the exact keyframe value
 * is returned with no floating-point drift.
 *
 * @param a - Start value (returned when t = 0).
 * @param b - End value (returned when t = 1).
 * @param t - Interpolation parameter in [0, 1].
 * @returns The interpolated value.
 *
 * Requirements: 11.4, 11.6
 */
export function lerpValue(a: number, b: number, t: number): number {
  // Return exact values at boundaries to avoid floating-point drift.
  if (t === 0) return a;
  if (t === 1) return b;
  return a + (b - a) * t;
}

// ---------------------------------------------------------------------------
// switchString — String property switching at midpoint
// ---------------------------------------------------------------------------

/**
 * Switch between two string values at the midpoint.
 *
 * @param a - First string (returned when t < 0.5).
 * @param b - Second string (returned when t ≥ 0.5).
 * @param t - Interpolation parameter in [0, 1].
 * @returns `a` if t < 0.5, otherwise `b`.
 *
 * Requirements: 11.4, 11.6
 */
export function switchString(a: string, b: string, t: number): string {
  return t < 0.5 ? a : b;
}

// ---------------------------------------------------------------------------
// interpolateProperties — Interpolate all properties between two keyframes
// ---------------------------------------------------------------------------

/**
 * Interpolate all properties between two property bags.
 *
 * - Numeric properties are linearly interpolated.
 * - String properties switch at the midpoint (t < 0.5 → first, t ≥ 0.5 → second).
 * - Properties present in only one bag are passed through as-is.
 *
 * @param propsA - Properties from the first keyframe.
 * @param propsB - Properties from the second keyframe.
 * @param t      - Interpolation parameter in [0, 1].
 * @returns Interpolated property bag.
 *
 * Requirements: 11.4, 11.6
 */
export function interpolateProperties(
  propsA: Record<string, number | string>,
  propsB: Record<string, number | string>,
  t: number,
): Record<string, number | string> {
  const result: Record<string, number | string> = {};

  // Collect all unique keys from both property bags.
  const allKeys = new Set([...Object.keys(propsA), ...Object.keys(propsB)]);

  for (const key of allKeys) {
    const hasA = key in propsA;
    const hasB = key in propsB;

    if (hasA && hasB) {
      const valA = propsA[key];
      const valB = propsB[key];

      if (typeof valA === 'number' && typeof valB === 'number') {
        result[key] = lerpValue(valA, valB, t);
      } else {
        // Both are strings, or mixed types — use string switching.
        result[key] = switchString(String(valA), String(valB), t);
      }
    } else if (hasA) {
      result[key] = propsA[key];
    } else {
      result[key] = propsB[key];
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// calculateOpacity — Fade in/out opacity for partial-range objects
// ---------------------------------------------------------------------------

/**
 * Calculate the opacity of an object based on the slider position relative
 * to the object's layer range.
 *
 * - Fade in:  opacity 0→1 from `firstIndex - 0.5` to `firstIndex`
 * - Full:     opacity 1.0 within [firstIndex, lastIndex]
 * - Fade out: opacity 1→0 from `lastIndex` to `lastIndex + 0.5`
 * - Outside:  opacity 0.0
 *
 * @param position   - Current slider position (continuous).
 * @param firstIndex - Layer index where the object first appears.
 * @param lastIndex  - Layer index where the object last appears.
 * @returns Opacity in [0, 1].
 *
 * Requirements: 11.7
 */
export function calculateOpacity(
  position: number,
  firstIndex: number,
  lastIndex: number,
): number {
  // Before the fade-in zone
  if (position < firstIndex - 0.5) return 0;

  // Fade-in zone: [firstIndex - 0.5, firstIndex]
  if (position < firstIndex) {
    return (position - (firstIndex - 0.5)) / 0.5;
  }

  // Full opacity within the object's range
  if (position <= lastIndex) return 1;

  // Fade-out zone: (lastIndex, lastIndex + 0.5]
  if (position <= lastIndex + 0.5) {
    return ((lastIndex + 0.5) - position) / 0.5;
  }

  // Beyond the fade-out zone
  return 0;
}

// ---------------------------------------------------------------------------
// interpolate — Main interpolation function
// ---------------------------------------------------------------------------

/**
 * Interpolate all keyframe sequences at the given slider position.
 *
 * For each {@link KeyframeSequence}:
 *   1. Find the two surrounding keyframes for the current position.
 *   2. Interpolate lat/lng using slerp.
 *   3. Interpolate numeric properties using lerp.
 *   4. Switch string properties at the midpoint.
 *   5. Calculate opacity using fade in/out logic.
 *
 * @param sequences - Array of keyframe sequences (one per object).
 * @param position  - Current slider position (continuous value).
 * @returns Array of interpolated objects with their computed properties and opacity.
 *
 * Requirements: 11.4, 11.5, 11.6, 11.7
 */
export function interpolate(
  sequences: KeyframeSequence[],
  position: number,
): InterpolatedObject[] {
  const results: InterpolatedObject[] = [];

  for (const seq of sequences) {
    const { keyframes, firstIndex, lastIndex, objectId } = seq;

    // Calculate opacity — skip objects that are fully transparent.
    const opacity = calculateOpacity(position, firstIndex, lastIndex);
    if (opacity <= 0) continue;

    // Single keyframe — no interpolation needed.
    if (keyframes.length === 1) {
      const kf = keyframes[0];
      results.push({
        objectId,
        latitude: kf.latitude,
        longitude: kf.longitude,
        properties: { ...kf.properties },
        opacity,
      });
      continue;
    }

    // Find the two surrounding keyframes.
    // Position is clamped to the keyframe range.
    const clampedPos = Math.max(
      keyframes[0].layerIndex,
      Math.min(keyframes[keyframes.length - 1].layerIndex, position),
    );

    // Find the right keyframe index (first keyframe with layerIndex >= clampedPos).
    let rightIdx = keyframes.findIndex((kf) => kf.layerIndex >= clampedPos);
    if (rightIdx === -1) rightIdx = keyframes.length - 1;

    // If we're exactly at or before the first keyframe, use the first keyframe.
    if (rightIdx === 0) {
      const kf = keyframes[0];
      results.push({
        objectId,
        latitude: kf.latitude,
        longitude: kf.longitude,
        properties: { ...kf.properties },
        opacity,
      });
      continue;
    }

    const leftIdx = rightIdx - 1;
    const kfA = keyframes[leftIdx];
    const kfB = keyframes[rightIdx];

    // Compute local t ∈ [0, 1] between the two keyframes.
    const span = kfB.layerIndex - kfA.layerIndex;
    const t = span === 0 ? 0 : (clampedPos - kfA.layerIndex) / span;

    // At exact integer positions, return exact keyframe values (no drift).
    if (t === 0) {
      results.push({
        objectId,
        latitude: kfA.latitude,
        longitude: kfA.longitude,
        properties: { ...kfA.properties },
        opacity,
      });
      continue;
    }
    if (t === 1) {
      results.push({
        objectId,
        latitude: kfB.latitude,
        longitude: kfB.longitude,
        properties: { ...kfB.properties },
        opacity,
      });
      continue;
    }

    // Interpolate lat/lng using slerp.
    const { lat, lng } = slerpLatLng(
      kfA.latitude,
      kfA.longitude,
      kfB.latitude,
      kfB.longitude,
      t,
    );

    // Interpolate properties.
    const properties = interpolateProperties(kfA.properties, kfB.properties, t);

    results.push({
      objectId,
      latitude: lat,
      longitude: lng,
      properties,
      opacity,
    });
  }

  return results;
}
