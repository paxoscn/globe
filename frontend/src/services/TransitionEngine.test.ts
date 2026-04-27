/**
 * Unit tests for TransitionEngine — keyframe sequence construction,
 * interpolation, and fade in/out opacity.
 *
 * Validates Requirements 11.1, 11.2, 11.3, 11.4, 11.6, 11.7
 */

import { describe, it, expect } from 'vitest';
import {
  buildKeyframes,
  lerpValue,
  switchString,
  interpolateProperties,
  calculateOpacity,
  interpolate,
  type ObjectRefMap,
} from './TransitionEngine';
import type {
  LayerGroupMeta,
  LayerMeta,
  ObjectReference,
  KeyframeSequence,
  Keyframe,
} from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal LayerMeta for testing. */
function makeLayer(id: string, name?: string): LayerMeta {
  return {
    id,
    name: name ?? id,
    description: '',
    enabled: true,
    lodLevels: [0, 1, 2],
  };
}

/** Create a minimal LayerGroupMeta for testing. */
function makeGroup(id: string, layers: LayerMeta[]): LayerGroupMeta {
  return {
    id,
    name: id,
    layers,
    currentPosition: 0,
  };
}

/** Create an ObjectReference. */
function makeRef(
  objectId: string,
  layerId: string,
  lat: number,
  lng: number,
  properties: Record<string, number | string> = {},
): ObjectReference {
  return { objectId, layerId, latitude: lat, longitude: lng, properties };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TransitionEngine — buildKeyframes', () => {
  it('returns empty array when objectRefs map is empty', () => {
    const group = makeGroup('g1', [makeLayer('L0'), makeLayer('L1')]);
    const refs: ObjectRefMap = new Map();

    const result = buildKeyframes(group, refs);

    expect(result).toEqual([]);
  });

  it('returns empty array when no layers in the group', () => {
    const group = makeGroup('g1', []);
    const refs: ObjectRefMap = new Map([
      ['L0', [makeRef('obj1', 'L0', 10, 20)]],
    ]);

    const result = buildKeyframes(group, refs);

    expect(result).toEqual([]);
  });

  it('builds a single keyframe for an object appearing in one layer', () => {
    const group = makeGroup('g1', [makeLayer('L0'), makeLayer('L1')]);
    const refs: ObjectRefMap = new Map([
      ['L0', [makeRef('obj1', 'L0', 48.85, 2.35, { title: 'Paris' })]],
    ]);

    const result = buildKeyframes(group, refs);

    expect(result).toHaveLength(1);
    expect(result[0].objectId).toBe('obj1');
    expect(result[0].keyframes).toHaveLength(1);
    expect(result[0].keyframes[0]).toEqual({
      layerIndex: 0,
      latitude: 48.85,
      longitude: 2.35,
      properties: { title: 'Paris' },
    });
    expect(result[0].firstIndex).toBe(0);
    expect(result[0].lastIndex).toBe(0);
  });

  it('builds keyframes across multiple layers for the same object', () => {
    const layers = [makeLayer('L0'), makeLayer('L1'), makeLayer('L2')];
    const group = makeGroup('g1', layers);
    const refs: ObjectRefMap = new Map([
      ['L0', [makeRef('napoleon', 'L0', 48.85, 2.35, { year: 1804 })]],
      ['L1', [makeRef('napoleon', 'L1', 48.20, 16.37, { year: 1805 })]],
      ['L2', [makeRef('napoleon', 'L2', 41.90, 12.49, { year: 1806 })]],
    ]);

    const result = buildKeyframes(group, refs);

    expect(result).toHaveLength(1);
    const seq = result[0];
    expect(seq.objectId).toBe('napoleon');
    expect(seq.keyframes).toHaveLength(3);
    expect(seq.firstIndex).toBe(0);
    expect(seq.lastIndex).toBe(2);

    // Keyframes should be ordered by layer index
    expect(seq.keyframes[0].layerIndex).toBe(0);
    expect(seq.keyframes[1].layerIndex).toBe(1);
    expect(seq.keyframes[2].layerIndex).toBe(2);

    // Verify positions
    expect(seq.keyframes[0].latitude).toBe(48.85);
    expect(seq.keyframes[1].latitude).toBe(48.20);
    expect(seq.keyframes[2].latitude).toBe(41.90);
  });

  it('handles multiple objects across layers', () => {
    const layers = [makeLayer('L0'), makeLayer('L1')];
    const group = makeGroup('g1', layers);
    const refs: ObjectRefMap = new Map([
      [
        'L0',
        [
          makeRef('obj-a', 'L0', 10, 20),
          makeRef('obj-b', 'L0', 30, 40),
        ],
      ],
      [
        'L1',
        [
          makeRef('obj-a', 'L1', 11, 21),
          makeRef('obj-b', 'L1', 31, 41),
        ],
      ],
    ]);

    const result = buildKeyframes(group, refs);

    expect(result).toHaveLength(2);

    const seqA = result.find((s) => s.objectId === 'obj-a')!;
    const seqB = result.find((s) => s.objectId === 'obj-b')!;

    expect(seqA.keyframes).toHaveLength(2);
    expect(seqB.keyframes).toHaveLength(2);

    expect(seqA.firstIndex).toBe(0);
    expect(seqA.lastIndex).toBe(1);
    expect(seqB.firstIndex).toBe(0);
    expect(seqB.lastIndex).toBe(1);
  });

  it('tracks correct firstIndex and lastIndex for partial-range objects', () => {
    const layers = [
      makeLayer('L0'),
      makeLayer('L1'),
      makeLayer('L2'),
      makeLayer('L3'),
    ];
    const group = makeGroup('g1', layers);

    // obj-a appears only in L1 and L2 (indices 1 and 2)
    const refs: ObjectRefMap = new Map([
      ['L1', [makeRef('obj-a', 'L1', 10, 20)]],
      ['L2', [makeRef('obj-a', 'L2', 15, 25)]],
    ]);

    const result = buildKeyframes(group, refs);

    expect(result).toHaveLength(1);
    expect(result[0].firstIndex).toBe(1);
    expect(result[0].lastIndex).toBe(2);
  });

  it('ignores object references for layers not in the group', () => {
    const group = makeGroup('g1', [makeLayer('L0'), makeLayer('L1')]);
    const refs: ObjectRefMap = new Map([
      ['L0', [makeRef('obj1', 'L0', 10, 20)]],
      // L-unknown is not in the group
      ['L-unknown', [makeRef('obj2', 'L-unknown', 30, 40)]],
    ]);

    const result = buildKeyframes(group, refs);

    expect(result).toHaveLength(1);
    expect(result[0].objectId).toBe('obj1');
  });

  it('preserves properties as a copy (no shared references)', () => {
    const group = makeGroup('g1', [makeLayer('L0')]);
    const originalProps = { year: 1804, title: 'Emperor' };
    const refs: ObjectRefMap = new Map([
      ['L0', [makeRef('obj1', 'L0', 10, 20, originalProps)]],
    ]);

    const result = buildKeyframes(group, refs);

    // Mutating the original should not affect the keyframe
    originalProps.year = 9999;
    expect(result[0].keyframes[0].properties.year).toBe(1804);
  });

  it('handles an object appearing in non-consecutive layers', () => {
    const layers = [
      makeLayer('L0'),
      makeLayer('L1'),
      makeLayer('L2'),
      makeLayer('L3'),
    ];
    const group = makeGroup('g1', layers);

    // obj-a appears in L0 and L3 (skipping L1 and L2)
    const refs: ObjectRefMap = new Map([
      ['L0', [makeRef('obj-a', 'L0', 10, 20)]],
      ['L3', [makeRef('obj-a', 'L3', 40, 50)]],
    ]);

    const result = buildKeyframes(group, refs);

    expect(result).toHaveLength(1);
    const seq = result[0];
    expect(seq.keyframes).toHaveLength(2);
    expect(seq.keyframes[0].layerIndex).toBe(0);
    expect(seq.keyframes[1].layerIndex).toBe(3);
    expect(seq.firstIndex).toBe(0);
    expect(seq.lastIndex).toBe(3);
  });

  it('handles a single layer group with one layer', () => {
    const group = makeGroup('g1', [makeLayer('L0')]);
    const refs: ObjectRefMap = new Map([
      ['L0', [makeRef('obj1', 'L0', 10, 20, { name: 'test' })]],
    ]);

    const result = buildKeyframes(group, refs);

    expect(result).toHaveLength(1);
    expect(result[0].firstIndex).toBe(0);
    expect(result[0].lastIndex).toBe(0);
    expect(result[0].keyframes).toHaveLength(1);
  });
});


// ===========================================================================
// lerpValue
// ===========================================================================

describe('TransitionEngine — lerpValue', () => {
  it('returns exact start value at t=0', () => {
    expect(lerpValue(10, 20, 0)).toBe(10);
  });

  it('returns exact end value at t=1', () => {
    expect(lerpValue(10, 20, 1)).toBe(20);
  });

  it('returns midpoint at t=0.5', () => {
    expect(lerpValue(0, 100, 0.5)).toBe(50);
  });

  it('interpolates correctly at t=0.25', () => {
    expect(lerpValue(0, 100, 0.25)).toBe(25);
  });

  it('handles negative values', () => {
    expect(lerpValue(-10, 10, 0.5)).toBe(0);
  });

  it('handles equal values', () => {
    expect(lerpValue(42, 42, 0.7)).toBe(42);
  });

  it('returns exact value at t=0 with no floating-point drift', () => {
    // Use values that could cause drift with naive a*(1-t) + b*t
    const a = 1.0000000000000002;
    const b = 9.999999999999998;
    expect(lerpValue(a, b, 0)).toBe(a);
    expect(lerpValue(a, b, 1)).toBe(b);
  });
});

// ===========================================================================
// switchString
// ===========================================================================

describe('TransitionEngine — switchString', () => {
  it('returns first string when t < 0.5', () => {
    expect(switchString('hello', 'world', 0)).toBe('hello');
    expect(switchString('hello', 'world', 0.49)).toBe('hello');
  });

  it('returns second string when t >= 0.5', () => {
    expect(switchString('hello', 'world', 0.5)).toBe('world');
    expect(switchString('hello', 'world', 1)).toBe('world');
  });

  it('returns second string at exactly t=0.5', () => {
    expect(switchString('a', 'b', 0.5)).toBe('b');
  });
});

// ===========================================================================
// interpolateProperties
// ===========================================================================

describe('TransitionEngine — interpolateProperties', () => {
  it('interpolates numeric properties', () => {
    const result = interpolateProperties(
      { year: 1800, population: 100 },
      { year: 1900, population: 200 },
      0.5,
    );
    expect(result.year).toBe(1850);
    expect(result.population).toBe(150);
  });

  it('switches string properties at midpoint', () => {
    const result = interpolateProperties(
      { title: 'Emperor', city: 'Paris' },
      { title: 'Exile', city: 'Elba' },
      0.3,
    );
    expect(result.title).toBe('Emperor');
    expect(result.city).toBe('Paris');

    const result2 = interpolateProperties(
      { title: 'Emperor', city: 'Paris' },
      { title: 'Exile', city: 'Elba' },
      0.7,
    );
    expect(result2.title).toBe('Exile');
    expect(result2.city).toBe('Elba');
  });

  it('handles mixed numeric and string properties', () => {
    const result = interpolateProperties(
      { year: 1800, title: 'General' },
      { year: 1810, title: 'Emperor' },
      0.5,
    );
    expect(result.year).toBe(1805);
    expect(result.title).toBe('Emperor');
  });

  it('passes through properties present in only one bag', () => {
    const result = interpolateProperties(
      { a: 10 },
      { b: 'hello' },
      0.5,
    );
    expect(result.a).toBe(10);
    expect(result.b).toBe('hello');
  });

  it('returns exact values at t=0 and t=1', () => {
    const propsA = { x: 100, name: 'start' };
    const propsB = { x: 200, name: 'end' };

    const at0 = interpolateProperties(propsA, propsB, 0);
    expect(at0.x).toBe(100);
    expect(at0.name).toBe('start');

    const at1 = interpolateProperties(propsA, propsB, 1);
    expect(at1.x).toBe(200);
    expect(at1.name).toBe('end');
  });
});

// ===========================================================================
// calculateOpacity
// ===========================================================================

describe('TransitionEngine — calculateOpacity', () => {
  it('returns 0 before the fade-in zone', () => {
    expect(calculateOpacity(0, 2, 5)).toBe(0);
    expect(calculateOpacity(1.4, 2, 5)).toBe(0);
  });

  it('returns 0 at exactly firstIndex - 0.5', () => {
    expect(calculateOpacity(1.5, 2, 5)).toBe(0);
  });

  it('fades in from 0 to 1 between firstIndex-0.5 and firstIndex', () => {
    // Midpoint of fade-in: firstIndex - 0.25
    expect(calculateOpacity(1.75, 2, 5)).toBeCloseTo(0.5, 10);
    // Just before firstIndex
    expect(calculateOpacity(1.9, 2, 5)).toBeCloseTo(0.8, 10);
  });

  it('returns 1 at firstIndex', () => {
    expect(calculateOpacity(2, 2, 5)).toBe(1);
  });

  it('returns 1 within the object range', () => {
    expect(calculateOpacity(3, 2, 5)).toBe(1);
    expect(calculateOpacity(4, 2, 5)).toBe(1);
  });

  it('returns 1 at lastIndex', () => {
    expect(calculateOpacity(5, 2, 5)).toBe(1);
  });

  it('fades out from 1 to 0 between lastIndex and lastIndex+0.5', () => {
    expect(calculateOpacity(5.25, 2, 5)).toBeCloseTo(0.5, 10);
    expect(calculateOpacity(5.4, 2, 5)).toBeCloseTo(0.2, 10);
  });

  it('returns 0 at exactly lastIndex + 0.5', () => {
    expect(calculateOpacity(5.5, 2, 5)).toBe(0);
  });

  it('returns 0 beyond the fade-out zone', () => {
    expect(calculateOpacity(6, 2, 5)).toBe(0);
    expect(calculateOpacity(100, 2, 5)).toBe(0);
  });

  it('handles single-layer object (firstIndex === lastIndex)', () => {
    // At the layer itself
    expect(calculateOpacity(3, 3, 3)).toBe(1);
    // Fade-in zone
    expect(calculateOpacity(2.75, 3, 3)).toBeCloseTo(0.5, 10);
    // Fade-out zone
    expect(calculateOpacity(3.25, 3, 3)).toBeCloseTo(0.5, 10);
    // Outside
    expect(calculateOpacity(2.4, 3, 3)).toBe(0);
    expect(calculateOpacity(3.6, 3, 3)).toBe(0);
  });
});

// ===========================================================================
// interpolate — main interpolation function
// ===========================================================================

describe('TransitionEngine — interpolate', () => {
  /** Helper to build a KeyframeSequence. */
  function makeSequence(
    objectId: string,
    keyframes: Keyframe[],
  ): KeyframeSequence {
    const sorted = [...keyframes].sort((a, b) => a.layerIndex - b.layerIndex);
    return {
      objectId,
      keyframes: sorted,
      firstIndex: sorted[0].layerIndex,
      lastIndex: sorted[sorted.length - 1].layerIndex,
    };
  }

  it('returns exact keyframe values at integer positions', () => {
    const seq = makeSequence('obj1', [
      { layerIndex: 0, latitude: 10, longitude: 20, properties: { year: 1800 } },
      { layerIndex: 1, latitude: 30, longitude: 40, properties: { year: 1900 } },
    ]);

    const atZero = interpolate([seq], 0);
    expect(atZero).toHaveLength(1);
    expect(atZero[0].latitude).toBe(10);
    expect(atZero[0].longitude).toBe(20);
    expect(atZero[0].properties.year).toBe(1800);

    const atOne = interpolate([seq], 1);
    expect(atOne).toHaveLength(1);
    expect(atOne[0].latitude).toBe(30);
    expect(atOne[0].longitude).toBe(40);
    expect(atOne[0].properties.year).toBe(1900);
  });

  it('interpolates numeric properties between keyframes', () => {
    const seq = makeSequence('obj1', [
      { layerIndex: 0, latitude: 0, longitude: 0, properties: { val: 0 } },
      { layerIndex: 2, latitude: 0, longitude: 0, properties: { val: 100 } },
    ]);

    const result = interpolate([seq], 1); // midpoint between 0 and 2
    expect(result).toHaveLength(1);
    expect(result[0].properties.val).toBe(50);
  });

  it('switches string properties at midpoint between keyframes', () => {
    const seq = makeSequence('obj1', [
      { layerIndex: 0, latitude: 0, longitude: 0, properties: { name: 'alpha' } },
      { layerIndex: 1, latitude: 0, longitude: 0, properties: { name: 'beta' } },
    ]);

    // t < 0.5 → first value
    const before = interpolate([seq], 0.3);
    expect(before[0].properties.name).toBe('alpha');

    // t >= 0.5 → second value
    const after = interpolate([seq], 0.7);
    expect(after[0].properties.name).toBe('beta');
  });

  it('applies fade-in opacity for partial-range objects', () => {
    const seq = makeSequence('obj1', [
      { layerIndex: 2, latitude: 10, longitude: 20, properties: {} },
      { layerIndex: 4, latitude: 30, longitude: 40, properties: {} },
    ]);

    // Before fade-in zone — should not appear
    const before = interpolate([seq], 1.4);
    expect(before).toHaveLength(0);

    // In fade-in zone
    const fadeIn = interpolate([seq], 1.75);
    expect(fadeIn).toHaveLength(1);
    expect(fadeIn[0].opacity).toBeCloseTo(0.5, 10);

    // At firstIndex — full opacity
    const atFirst = interpolate([seq], 2);
    expect(atFirst).toHaveLength(1);
    expect(atFirst[0].opacity).toBe(1);
  });

  it('applies fade-out opacity for partial-range objects', () => {
    const seq = makeSequence('obj1', [
      { layerIndex: 0, latitude: 10, longitude: 20, properties: {} },
      { layerIndex: 2, latitude: 30, longitude: 40, properties: {} },
    ]);

    // At lastIndex — full opacity
    const atLast = interpolate([seq], 2);
    expect(atLast).toHaveLength(1);
    expect(atLast[0].opacity).toBe(1);

    // In fade-out zone
    const fadeOut = interpolate([seq], 2.25);
    expect(fadeOut).toHaveLength(1);
    expect(fadeOut[0].opacity).toBeCloseTo(0.5, 10);

    // Beyond fade-out — should not appear
    const beyond = interpolate([seq], 2.6);
    expect(beyond).toHaveLength(0);
  });

  it('handles single-keyframe sequences', () => {
    const seq = makeSequence('obj1', [
      { layerIndex: 1, latitude: 45, longitude: 90, properties: { name: 'solo' } },
    ]);

    const result = interpolate([seq], 1);
    expect(result).toHaveLength(1);
    expect(result[0].latitude).toBe(45);
    expect(result[0].longitude).toBe(90);
    expect(result[0].properties.name).toBe('solo');
    expect(result[0].opacity).toBe(1);
  });

  it('handles multiple sequences simultaneously', () => {
    const seq1 = makeSequence('obj-a', [
      { layerIndex: 0, latitude: 10, longitude: 20, properties: {} },
      { layerIndex: 2, latitude: 30, longitude: 40, properties: {} },
    ]);
    const seq2 = makeSequence('obj-b', [
      { layerIndex: 1, latitude: 50, longitude: 60, properties: {} },
      { layerIndex: 3, latitude: 70, longitude: 80, properties: {} },
    ]);

    const result = interpolate([seq1, seq2], 1.5);
    expect(result).toHaveLength(2);

    const objA = result.find((r) => r.objectId === 'obj-a');
    const objB = result.find((r) => r.objectId === 'obj-b');
    expect(objA).toBeDefined();
    expect(objB).toBeDefined();
  });

  it('returns empty array when position is outside all object ranges', () => {
    const seq = makeSequence('obj1', [
      { layerIndex: 2, latitude: 10, longitude: 20, properties: {} },
      { layerIndex: 4, latitude: 30, longitude: 40, properties: {} },
    ]);

    const result = interpolate([seq], 10);
    expect(result).toHaveLength(0);
  });

  it('clamps position to keyframe range for interpolation', () => {
    const seq = makeSequence('obj1', [
      { layerIndex: 1, latitude: 10, longitude: 20, properties: { v: 100 } },
      { layerIndex: 3, latitude: 30, longitude: 40, properties: { v: 300 } },
    ]);

    // Position within fade-in zone but before first keyframe
    // Should use first keyframe values (clamped)
    const result = interpolate([seq], 0.8);
    expect(result).toHaveLength(1);
    expect(result[0].latitude).toBe(10);
    expect(result[0].properties.v).toBe(100);
  });
});
