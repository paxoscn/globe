/**
 * App — Root component for the Vector Globe Viewer.
 *
 * Initializes application state, fetches layer metadata, and wires together:
 * - GlobeRenderer (3D globe with vector data)
 * - LayerManager (layer list, toggles, group sliders, inline timeline sliders)
 * - ViewControls (reset orientation / zoom buttons)
 * - Layout (responsive desktop sidebar / mobile drawer)
 * - TileLoader + MemoryManager (tile loading pipeline)
 * - TransitionEngine (keyframe interpolation for layer group slider)
 *
 * Requirements: 1.1, 5.1, 6.1, 6.3, 8.1, 9.1, 9.2, 9.3, 11.4, 11.5, 11.8
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type {
  LayerMeta,
  LayerGroupMeta,
  Viewport,
  InterpolatedObject,
  ObjectReference,
  EnabledLayer,
} from './types';
import type { FeatureCollection } from './types/geojson';
import { MemoryManager } from './services/MemoryManager';
import { TileLoader } from './services/TileLoader';
import { buildKeyframes, interpolate } from './services/TransitionEngine';
import type { ObjectRefMap } from './services/TransitionEngine';
import GlobeRenderer from './components/GlobeRenderer';
import type { GlobeHandle } from './components/GlobeRenderer';
import LayerManager from './components/LayerManager';
import ViewControls from './components/ViewControls';
import Layout from './components/Layout';
import {
  MOCK_LAYERS,
  MOCK_GEOJSON,
  NAPOLEON_LAYER_ID,
  NAPOLEON_TRAJECTORY,
  TRAJECTORY_START,
  interpolatePosition,
  interpolateContinents,
} from './data/mockLayers';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Debounce delay (ms) for viewport change events to avoid excessive tile requests. */
const VIEWPORT_DEBOUNCE_MS = 150;

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

interface ApiLayerResponse {
  id: string;
  name: string;
  group_id?: string | null;
  lod_levels: number[];
  object_refs?: string[];
  description?: string;
}

interface ApiGroupResponse {
  id: string;
  name: string;
  layer_ids: string[];
  description?: string;
}

interface ApiLayersResponse {
  layers: ApiLayerResponse[];
  groups: ApiGroupResponse[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse the API /api/layers response into LayerMeta[] and LayerGroupMeta[].
 */
function parseLayerMetadata(data: ApiLayersResponse): {
  layers: LayerMeta[];
  layerGroups: LayerGroupMeta[];
} {
  const layerMap = new Map<string, LayerMeta>();

  for (const l of data.layers) {
    const meta: LayerMeta = {
      id: l.id,
      name: l.name,
      description: l.description ?? '',
      enabled: false,
      lodLevels: l.lod_levels,
    };
    layerMap.set(l.id, meta);
  }

  const layerGroups: LayerGroupMeta[] = data.groups.map((g) => ({
    id: g.id,
    name: g.name,
    layers: g.layer_ids
      .map((id) => layerMap.get(id))
      .filter((l): l is LayerMeta => l !== undefined),
    currentPosition: 0,
  }));

  return {
    layers: Array.from(layerMap.values()),
    layerGroups,
  };
}

// ---------------------------------------------------------------------------
// App Component
// ---------------------------------------------------------------------------

export default function App() {
  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------

  const [layers, setLayers] = useState<LayerMeta[]>([]);
  const [layerGroups, setLayerGroups] = useState<LayerGroupMeta[]>([]);
  const [activeLayerIds, setActiveLayerIds] = useState<Set<string>>(new Set());
  const [interpolatedObjects, setInterpolatedObjects] = useState<InterpolatedObject[]>([]);
  const [, setError] = useState<string | null>(null);

  // Unified per-layer timeline values (keyed by layer ID)
  // world-borders → Ma value (0 = present), napoleon-trajectory → timestamp
  const [layerTimeValues, setLayerTimeValues] = useState<Record<string, number>>({
    'world-borders': 0,
    [NAPOLEON_LAYER_ID]: TRAJECTORY_START,
  });

  const handleLayerTimeChange = useCallback((layerId: string, value: number) => {
    setLayerTimeValues((prev) => ({ ...prev, [layerId]: value }));
  }, []);

  // Derived convenience values
  const napoleonEnabled = activeLayerIds.has(NAPOLEON_LAYER_ID);
  const napoleonTime = layerTimeValues[NAPOLEON_LAYER_ID] ?? TRAJECTORY_START;
  const driftMa = layerTimeValues['world-borders'] ?? 0;
  const worldBordersEnabled = activeLayerIds.has('world-borders');

  const napoleonPosition = useMemo(() => {
    if (!napoleonEnabled) return null;
    const pos = interpolatePosition(napoleonTime);
    return { lat: pos.lat, lng: pos.lng, campaign: pos.campaign };
  }, [napoleonTime, napoleonEnabled]);

  // Refs for services (stable across renders)
  const memoryManagerRef = useRef<MemoryManager>(new MemoryManager());
  const tileLoaderRef = useRef<TileLoader>(new TileLoader(memoryManagerRef.current));
  const viewportRef = useRef<Viewport | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const globeRef = useRef<GlobeHandle>(null);

  // Object references per layer group (fetched alongside layer metadata)
  const objectRefsRef = useRef<Map<string, ObjectRefMap>>(new Map());

  // -----------------------------------------------------------------------
  // Fetch layer metadata on mount
  // -----------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function fetchLayers() {
      try {
        const response = await fetch('/api/layers');
        if (!response.ok) {
          throw new Error(`Failed to fetch layers: ${response.status}`);
        }
        const data: ApiLayersResponse = await response.json();
        if (cancelled) return;

        const { layers: parsedLayers, layerGroups: parsedGroups } =
          parseLayerMetadata(data);

        setLayers(parsedLayers);
        setLayerGroups(parsedGroups);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('API unavailable, using mock layer data:', msg);

        // Fall back to mock data
        setLayers(MOCK_LAYERS);
        setLayerGroups([]);

        // Enable layers that are marked enabled by default
        const initialActive = new Set<string>();
        for (const l of MOCK_LAYERS) {
          if (l.enabled) initialActive.add(l.id);
        }
        setActiveLayerIds(initialActive);
      }
    }

    fetchLayers();
    return () => {
      cancelled = true;
    };
  }, []);

  // -----------------------------------------------------------------------
  // Layer toggle
  // -----------------------------------------------------------------------

  const handleLayerToggle = useCallback((layerId: string, enabled: boolean) => {
    setActiveLayerIds((prev) => {
      const next = new Set(prev);
      if (enabled) {
        next.add(layerId);
      } else {
        next.delete(layerId);
      }
      return next;
    });

    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, enabled } : l)),
    );

    // Also update layers inside layer groups
    setLayerGroups((prev) =>
      prev.map((g) => ({
        ...g,
        layers: g.layers.map((l) =>
          l.id === layerId ? { ...l, enabled } : l,
        ),
      })),
    );
  }, []);

  // -----------------------------------------------------------------------
  // Enabled layers derived from state
  // -----------------------------------------------------------------------

  const enabledLayers: EnabledLayer[] = useMemo(
    () =>
      layers
        .filter((l) => activeLayerIds.has(l.id))
        .map((l) => ({ layerId: l.id, meta: l })),
    [layers, activeLayerIds],
  );

  // Build a map of layerId → GeoJSON for all enabled layers (mock data)
  // For world-borders, apply continental drift interpolation when driftMa > 0
  const layerGeoJSON: Record<string, FeatureCollection> = useMemo(() => {
    const result: Record<string, FeatureCollection> = {};
    for (const el of enabledLayers) {
      if (el.layerId === 'world-borders') {
        // Use drift-interpolated continents
        result[el.layerId] = interpolateContinents(driftMa);
      } else {
        const data = MOCK_GEOJSON[el.layerId];
        if (data) result[el.layerId] = data;
      }
    }
    return result;
  }, [enabledLayers, driftMa]);

  // -----------------------------------------------------------------------
  // Viewport change → tile loading pipeline (Task 15.2)
  // -----------------------------------------------------------------------

  const handleViewportChange = useCallback(
    (viewport: Viewport) => {
      viewportRef.current = viewport;

      // Debounce to avoid excessive tile requests
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        const vp = viewportRef.current;
        if (!vp) return;

        // Run eviction on viewport change
        memoryManagerRef.current.evictOutOfViewport(vp);

        // For each enabled layer, load visible tiles
        const visibleTiles = vp.visibleTiles;
        if (visibleTiles.length === 0) return;

        // Compute viewport center for tile prioritization
        const centerLat =
          visibleTiles.reduce((sum, t) => {
            const n = 1 << t.z;
            const latRad = Math.atan(
              Math.sinh(Math.PI * (1 - (2 * (t.y + 0.5)) / n)),
            );
            return sum + (latRad * 180) / Math.PI;
          }, 0) / visibleTiles.length;

        const centerLng =
          visibleTiles.reduce((sum, t) => {
            const n = 1 << t.z;
            return sum + ((t.x + 0.5) / n) * 360 - 180;
          }, 0) / visibleTiles.length;

        const center = { lat: centerLat, lng: centerLng };

        // Load tiles for each enabled layer
        for (const el of enabledLayers) {
          tileLoaderRef.current.loadTiles(
            el.layerId,
            visibleTiles,
            center,
          );
        }
      }, VIEWPORT_DEBOUNCE_MS);
    },
    [enabledLayers],
  );

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // -----------------------------------------------------------------------
  // Layer group slider → TransitionEngine (Task 15.3)
  // -----------------------------------------------------------------------

  const handleGroupSliderChange = useCallback(
    (groupId: string, position: number) => {
      // Update the group's currentPosition
      setLayerGroups((prev) =>
        prev.map((g) =>
          g.id === groupId ? { ...g, currentPosition: position } : g,
        ),
      );

      // Find the group
      const group = layerGroups.find((g) => g.id === groupId);
      if (!group) return;

      const updatedGroup = { ...group, currentPosition: position };

      // Get or build object references for this group
      let objRefs = objectRefsRef.current.get(groupId);
      if (!objRefs) {
        objRefs = new Map<string, ObjectReference[]>();
        objectRefsRef.current.set(groupId, objRefs);
      }

      // Build keyframes and interpolate
      const sequences = buildKeyframes(updatedGroup, objRefs);
      const interpolated = interpolate(sequences, position);

      setInterpolatedObjects(interpolated);
    },
    [layerGroups],
  );

  // -----------------------------------------------------------------------
  // View reset callbacks
  // -----------------------------------------------------------------------

  const handleResetOrientation = useCallback(() => {
    globeRef.current?.resetOrientation();
  }, []);

  const handleResetZoom = useCallback(() => {
    globeRef.current?.resetZoom();
  }, []);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <Layout
      globe={
        <GlobeRenderer
          ref={globeRef}
          layers={enabledLayers}
          layerGeoJSON={layerGeoJSON}
          interpolatedObjects={interpolatedObjects}
          onViewportChange={handleViewportChange}
          napoleonPosition={napoleonEnabled ? napoleonPosition : null}
          napoleonTrajectory={napoleonEnabled ? NAPOLEON_TRAJECTORY : undefined}
          napoleonTime={napoleonEnabled ? napoleonTime : undefined}
        />
      }
      layerPanel={
        <LayerManager
          layers={layers}
          layerGroups={layerGroups}
          onLayerToggle={handleLayerToggle}
          onGroupSliderChange={handleGroupSliderChange}
          layerTimeValues={layerTimeValues}
          onLayerTimeChange={handleLayerTimeChange}
        />
      }
      overlayControls={
        <ViewControls
          onResetOrientation={handleResetOrientation}
          onResetZoom={handleResetZoom}
        />
      }
    />
  );
}
