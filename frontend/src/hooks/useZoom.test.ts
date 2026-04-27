/**
 * Unit tests for useZoom hook — pure math helpers.
 *
 * We test the exported helper functions (clamp, lerp, applyZoomDelta) directly
 * since the hook itself requires a react-three-fiber context.
 */

import { describe, it, expect } from 'vitest';
import { clamp, lerp, applyZoomDelta, DEFAULT_MIN_ZOOM, DEFAULT_MAX_ZOOM } from './useZoom';

// ---------------------------------------------------------------------------
// clamp
// ---------------------------------------------------------------------------

describe('clamp', () => {
  it('returns the value when within range', () => {
    expect(clamp(5, 1, 10)).toBe(5);
  });

  it('clamps to min when value is below range', () => {
    expect(clamp(-5, 1, 10)).toBe(1);
  });

  it('clamps to max when value is above range', () => {
    expect(clamp(15, 1, 10)).toBe(10);
  });

  it('returns min for -Infinity', () => {
    expect(clamp(-Infinity, 1, 10)).toBe(1);
  });

  it('returns max for +Infinity', () => {
    expect(clamp(Infinity, 1, 10)).toBe(10);
  });

  it('returns min for NaN', () => {
    expect(clamp(NaN, 1, 10)).toBe(1);
  });

  it('returns the boundary value when value equals min', () => {
    expect(clamp(1, 1, 10)).toBe(1);
  });

  it('returns the boundary value when value equals max', () => {
    expect(clamp(10, 1, 10)).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// lerp
// ---------------------------------------------------------------------------

describe('lerp', () => {
  it('returns a at t=0', () => {
    expect(lerp(2, 8, 0)).toBe(2);
  });

  it('returns b at t=1', () => {
    expect(lerp(2, 8, 1)).toBe(8);
  });

  it('returns midpoint at t=0.5', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
  });

  it('interpolates correctly for arbitrary t', () => {
    expect(lerp(10, 20, 0.3)).toBeCloseTo(13);
  });

  it('works with negative values', () => {
    expect(lerp(-10, 10, 0.5)).toBeCloseTo(0);
  });

  it('returns a when a equals b', () => {
    expect(lerp(5, 5, 0.7)).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// applyZoomDelta
// ---------------------------------------------------------------------------

describe('applyZoomDelta', () => {
  const min = DEFAULT_MIN_ZOOM; // 1
  const max = DEFAULT_MAX_ZOOM; // 10

  it('applies a positive delta within range', () => {
    expect(applyZoomDelta(5, 2, min, max)).toBe(7);
  });

  it('applies a negative delta within range', () => {
    expect(applyZoomDelta(5, -2, min, max)).toBe(3);
  });

  it('clamps to max when delta pushes above max', () => {
    expect(applyZoomDelta(8, 5, min, max)).toBe(max);
  });

  it('clamps to min when delta pushes below min', () => {
    expect(applyZoomDelta(2, -5, min, max)).toBe(min);
  });

  it('handles extremely large positive delta', () => {
    expect(applyZoomDelta(5, 1e10, min, max)).toBe(max);
  });

  it('handles extremely large negative delta', () => {
    expect(applyZoomDelta(5, -1e10, min, max)).toBe(min);
  });

  it('handles Infinity delta', () => {
    expect(applyZoomDelta(5, Infinity, min, max)).toBe(max);
  });

  it('handles -Infinity delta', () => {
    expect(applyZoomDelta(5, -Infinity, min, max)).toBe(min);
  });

  it('handles NaN delta by clamping to min', () => {
    const result = applyZoomDelta(5, NaN, min, max);
    expect(result).toBe(min);
  });

  it('returns current zoom when delta is zero', () => {
    expect(applyZoomDelta(5, 0, min, max)).toBe(5);
  });

  it('result is always within [min, max] for boundary current zoom', () => {
    expect(applyZoomDelta(min, -1, min, max)).toBe(min);
    expect(applyZoomDelta(max, 1, min, max)).toBe(max);
  });
});
