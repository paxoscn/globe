/**
 * Unit tests for useLayerState hook — pure helper functions.
 *
 * We test the exported pure helpers (applyToggle, buildLayerStates,
 * deriveInitialActiveIds) directly. The hook itself is a thin React wrapper
 * around these helpers.
 *
 * Requirements: 5.2 (enable layer), 5.3 (disable layer), 5.4 (multiple active)
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  applyToggle,
  buildLayerStates,
  deriveInitialActiveIds,
  useLayerState,
} from './useLayerState';
import type { LayerMeta } from '../types';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeLayers(...specs: Array<[string, boolean]>): LayerMeta[] {
  return specs.map(([id, enabled]) => ({
    id,
    name: `Layer ${id}`,
    description: `Description for ${id}`,
    enabled,
    lodLevels: [0, 1, 2],
  }));
}

// ---------------------------------------------------------------------------
// applyToggle
// ---------------------------------------------------------------------------

describe('applyToggle', () => {
  it('adds a layer when enabling a disabled layer', () => {
    const active = new Set(['a']);
    const result = applyToggle(active, 'b', true);
    expect(result.has('b')).toBe(true);
    expect(result.has('a')).toBe(true);
    expect(result.size).toBe(2);
  });

  it('removes a layer when disabling an enabled layer', () => {
    const active = new Set(['a', 'b']);
    const result = applyToggle(active, 'b', false);
    expect(result.has('b')).toBe(false);
    expect(result.has('a')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('is idempotent: enabling an already-enabled layer is a no-op', () => {
    const active = new Set(['a', 'b']);
    const result = applyToggle(active, 'a', true);
    expect(result.size).toBe(2);
    expect(result.has('a')).toBe(true);
    expect(result.has('b')).toBe(true);
  });

  it('is idempotent: disabling an already-disabled layer is a no-op', () => {
    const active = new Set(['a']);
    const result = applyToggle(active, 'b', false);
    expect(result.size).toBe(1);
    expect(result.has('a')).toBe(true);
    expect(result.has('b')).toBe(false);
  });

  it('does not mutate the input set', () => {
    const active = new Set(['a']);
    applyToggle(active, 'b', true);
    expect(active.size).toBe(1);
    expect(active.has('b')).toBe(false);
  });

  it('works with an empty set', () => {
    const active = new Set<string>();
    const result = applyToggle(active, 'x', true);
    expect(result.size).toBe(1);
    expect(result.has('x')).toBe(true);
  });

  it('returns empty set when disabling the only active layer', () => {
    const active = new Set(['x']);
    const result = applyToggle(active, 'x', false);
    expect(result.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildLayerStates
// ---------------------------------------------------------------------------

describe('buildLayerStates', () => {
  it('sets enabled=true for layers in the active set', () => {
    const layers = makeLayers(['a', false], ['b', false], ['c', false]);
    const active = new Set(['a', 'c']);
    const result = buildLayerStates(layers, active);

    expect(result[0].enabled).toBe(true);
    expect(result[1].enabled).toBe(false);
    expect(result[2].enabled).toBe(true);
  });

  it('preserves all other layer properties', () => {
    const layers = makeLayers(['a', false]);
    const result = buildLayerStates(layers, new Set(['a']));

    expect(result[0].id).toBe('a');
    expect(result[0].name).toBe('Layer a');
    expect(result[0].description).toBe('Description for a');
    expect(result[0].lodLevels).toEqual([0, 1, 2]);
  });

  it('returns empty array for empty input', () => {
    expect(buildLayerStates([], new Set())).toEqual([]);
  });

  it('does not mutate the original layers', () => {
    const layers = makeLayers(['a', false]);
    buildLayerStates(layers, new Set(['a']));
    expect(layers[0].enabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// deriveInitialActiveIds
// ---------------------------------------------------------------------------

describe('deriveInitialActiveIds', () => {
  it('includes layers with enabled=true', () => {
    const layers = makeLayers(['a', true], ['b', false], ['c', true]);
    const ids = deriveInitialActiveIds(layers);
    expect(ids.size).toBe(2);
    expect(ids.has('a')).toBe(true);
    expect(ids.has('c')).toBe(true);
  });

  it('returns empty set when no layers are enabled', () => {
    const layers = makeLayers(['a', false], ['b', false]);
    const ids = deriveInitialActiveIds(layers);
    expect(ids.size).toBe(0);
  });

  it('returns empty set for empty input', () => {
    const ids = deriveInitialActiveIds([]);
    expect(ids.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// useLayerState hook (integration via renderHook)
// ---------------------------------------------------------------------------

describe('useLayerState', () => {
  it('initializes with correct active layers from metadata', () => {
    const layers = makeLayers(['a', true], ['b', false], ['c', true]);
    const { result } = renderHook(() => useLayerState(layers));

    expect(result.current.activeIds.size).toBe(2);
    expect(result.current.activeIds.has('a')).toBe(true);
    expect(result.current.activeIds.has('c')).toBe(true);
    expect(result.current.layers[0].enabled).toBe(true);
    expect(result.current.layers[1].enabled).toBe(false);
    expect(result.current.layers[2].enabled).toBe(true);
  });

  it('toggleLayer enables a disabled layer', () => {
    const layers = makeLayers(['a', false], ['b', false]);
    const { result } = renderHook(() => useLayerState(layers));

    act(() => {
      result.current.toggleLayer('a', true);
    });

    expect(result.current.activeIds.has('a')).toBe(true);
    expect(result.current.layers[0].enabled).toBe(true);
  });

  it('toggleLayer disables an enabled layer', () => {
    const layers = makeLayers(['a', true], ['b', true]);
    const { result } = renderHook(() => useLayerState(layers));

    act(() => {
      result.current.toggleLayer('a', false);
    });

    expect(result.current.activeIds.has('a')).toBe(false);
    expect(result.current.layers[0].enabled).toBe(false);
    expect(result.current.layers[1].enabled).toBe(true);
  });

  it('toggleLayer is idempotent for enable', () => {
    const layers = makeLayers(['a', true]);
    const { result } = renderHook(() => useLayerState(layers));

    act(() => {
      result.current.toggleLayer('a', true);
    });

    expect(result.current.activeIds.has('a')).toBe(true);
    expect(result.current.activeIds.size).toBe(1);
  });

  it('toggleLayer is idempotent for disable', () => {
    const layers = makeLayers(['a', false]);
    const { result } = renderHook(() => useLayerState(layers));

    act(() => {
      result.current.toggleLayer('a', false);
    });

    expect(result.current.activeIds.has('a')).toBe(false);
    expect(result.current.activeIds.size).toBe(0);
  });

  it('supports multiple sequential toggles', () => {
    const layers = makeLayers(['a', false], ['b', false], ['c', false]);
    const { result } = renderHook(() => useLayerState(layers));

    act(() => {
      result.current.toggleLayer('a', true);
    });
    act(() => {
      result.current.toggleLayer('c', true);
    });
    act(() => {
      result.current.toggleLayer('a', false);
    });

    expect(result.current.activeIds.has('a')).toBe(false);
    expect(result.current.activeIds.has('b')).toBe(false);
    expect(result.current.activeIds.has('c')).toBe(true);
    expect(result.current.activeIds.size).toBe(1);
  });
});
