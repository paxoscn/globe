/**
 * useLayerState — Manages layer enabled/disabled state.
 *
 * Provides a React hook that tracks which layers are active (enabled) and
 * exposes a toggle function for enabling/disabling individual layers.
 * Enable/disable operations are idempotent: enabling an already-enabled layer
 * or disabling an already-disabled layer is a no-op.
 *
 * Pure helper functions (`applyToggle`, `buildLayerStates`) are exported
 * separately for unit and property testing.
 *
 * Requirements: 5.2 (enable layer), 5.3 (disable layer), 5.4 (multiple active layers)
 */

import { useState, useCallback, useMemo } from 'react';
import type { LayerMeta } from '../types';

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit / property testing)
// ---------------------------------------------------------------------------

/**
 * Apply a toggle operation to a set of active layer IDs.
 *
 * - If `enabled` is `true` and the layer is already in the set, this is a no-op.
 * - If `enabled` is `false` and the layer is not in the set, this is a no-op.
 * - Otherwise, returns a new Set with the layer added or removed.
 *
 * The function is pure: it never mutates the input set.
 */
export function applyToggle(
  activeIds: ReadonlySet<string>,
  layerId: string,
  enabled: boolean,
): Set<string> {
  const isActive = activeIds.has(layerId);

  // Idempotent: no change needed
  if (enabled && isActive) return new Set(activeIds);
  if (!enabled && !isActive) return new Set(activeIds);

  const next = new Set(activeIds);
  if (enabled) {
    next.add(layerId);
  } else {
    next.delete(layerId);
  }
  return next;
}

/**
 * Build an array of LayerMeta with updated `enabled` flags based on the
 * active layer ID set.
 */
export function buildLayerStates(
  layers: readonly LayerMeta[],
  activeIds: ReadonlySet<string>,
): LayerMeta[] {
  return layers.map((layer) => ({
    ...layer,
    enabled: activeIds.has(layer.id),
  }));
}

/**
 * Derive the initial set of active layer IDs from layer metadata.
 * Layers whose `enabled` field is `true` are included.
 */
export function deriveInitialActiveIds(layers: readonly LayerMeta[]): Set<string> {
  const ids = new Set<string>();
  for (const layer of layers) {
    if (layer.enabled) {
      ids.add(layer.id);
    }
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseLayerStateReturn {
  /** Current layers with up-to-date `enabled` flags. */
  layers: LayerMeta[];
  /** Set of currently active (enabled) layer IDs. */
  activeIds: ReadonlySet<string>;
  /** Toggle a layer's enabled state. Idempotent. */
  toggleLayer: (layerId: string, enabled: boolean) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * React hook for managing layer enabled/disabled state.
 *
 * Accepts initial layer metadata and returns the current layer states
 * along with a toggle function.
 *
 * @param initialLayers - Array of LayerMeta describing available layers.
 */
export function useLayerState(initialLayers: LayerMeta[]): UseLayerStateReturn {
  // Derive initial active IDs from the `enabled` flags on the input layers.
  const [activeIds, setActiveIds] = useState<Set<string>>(() =>
    deriveInitialActiveIds(initialLayers),
  );

  const toggleLayer = useCallback((layerId: string, enabled: boolean) => {
    setActiveIds((prev) => applyToggle(prev, layerId, enabled));
  }, []);

  // Rebuild layer array with current enabled states.
  const layers = useMemo(
    () => buildLayerStates(initialLayers, activeIds),
    [initialLayers, activeIds],
  );

  return { layers, activeIds, toggleLayer };
}
