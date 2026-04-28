/**
 * App — Root component for the Vector Globe Viewer.
 *
 * All layer metadata and tile data come from the backend API.
 * No layer-specific logic — layers are treated generically based on
 * their `timelineConfig` from the API response.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type {
  LayerMeta,
  LayerGroupMeta,
  Viewport,
  InterpolatedObject,
  ObjectReference,
  EnabledLayer,
  TimelineConfig,
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
import { PRESENT_YEAR, yearToMa } from './data/constants';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VIEWPORT_DEBOUNCE_MS = 150;

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------

interface ApiLayerResponse {
  id: string;
  name: string;
  group_id?: string | null;
  lod_levels: number[];
  object_refs?: string[];
  description?: string;
  timeline_config?: TimelineConfig | null;
}

interface ApiGroupResponse {
  id: string;
  name: string;
  layer_ids: string[];
}

interface ApiLayersResponse {
  layers: ApiLayerResponse[];
  groups: ApiGroupResponse[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseLayerMetadata(data: ApiLayersResponse): {
  layers: LayerMeta[];
  layerGroups: LayerGroupMeta[];
} {
  const layerMap = new Map<string, LayerMeta>();

  for (const l of data.layers) {
    layerMap.set(l.id, {
      id: l.id,
      name: l.name,
      description: l.description ?? '',
      enabled: false,
      lodLevels: l.lod_levels,
      timelineConfig: l.timeline_config ?? undefined,
    });
  }

  const layerGroups: LayerGroupMeta[] = data.groups.map((g) => ({
    id: g.id,
    name: g.name,
    layers: g.layer_ids
      .map((id) => layerMap.get(id))
      .filter((l): l is LayerMeta => l !== undefined),
    currentPosition: 0,
  }));

  return { layers: Array.from(layerMap.values()), layerGroups };
}

/**
 * Compute the integer time parameter for a layer's tile request
 * based on the shared currentYear and the layer's timelineConfig.
 * Returns undefined if the layer has no timeline.
 */
function computeTimeParam(
  config: TimelineConfig | undefined,
  currentYear: number,
): number | undefined {
  if (!config) return undefined;
  if (config.formatType === 'geological') {
    return Math.max(0, Math.round(yearToMa(currentYear)));
  }
  // For other timeline types (historical etc.), round to nearest year
  return Math.round(currentYear);
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  const [layers, setLayers] = useState<LayerMeta[]>([]);
  const [layerGroups, setLayerGroups] = useState<LayerGroupMeta[]>([]);
  const [activeLayerIds, setActiveLayerIds] = useState<Set<string>>(new Set());
  const [interpolatedObjects, setInterpolatedObjects] = useState<InterpolatedObject[]>([]);
  const [currentYear, setCurrentYear] = useState(PRESENT_YEAR);

  const memoryManagerRef = useRef<MemoryManager>(new MemoryManager());
  const tileLoaderRef = useRef<TileLoader>(new TileLoader(memoryManagerRef.current));
  const viewportRef = useRef<Viewport | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const globeRef = useRef<GlobeHandle>(null);
  const objectRefsRef = useRef<Map<string, ObjectRefMap>>(new Map());

  // -----------------------------------------------------------------------
  // Fetch layer metadata
  // -----------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/layers');
        if (!res.ok) throw new Error(`${res.status}`);
        const data: ApiLayersResponse = await res.json();
        if (cancelled) return;
        const { layers: l, layerGroups: g } = parseLayerMetadata(data);
        setLayers(l);
        setLayerGroups(g);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to fetch layer metadata:', err instanceof Error ? err.message : err);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // -----------------------------------------------------------------------
  // Layer toggle
  // -----------------------------------------------------------------------

  const handleLayerToggle = useCallback((layerId: string, enabled: boolean) => {
    setActiveLayerIds((prev) => {
      const next = new Set(prev);
      enabled ? next.add(layerId) : next.delete(layerId);
      return next;
    });
    setLayers((prev) => prev.map((l) => (l.id === layerId ? { ...l, enabled } : l)));
    setLayerGroups((prev) =>
      prev.map((g) => ({
        ...g,
        layers: g.layers.map((l) => (l.id === layerId ? { ...l, enabled } : l)),
      })),
    );
  }, []);

  // -----------------------------------------------------------------------
  // Enabled layers
  // -----------------------------------------------------------------------

  const enabledLayers: EnabledLayer[] = useMemo(
    () => layers.filter((l) => activeLayerIds.has(l.id)).map((l) => ({ layerId: l.id, meta: l })),
    [layers, activeLayerIds],
  );

  // -----------------------------------------------------------------------
  // Tile data — all layers fetched from /api/tiles/{id}/0/0/0[?time=N]
  // -----------------------------------------------------------------------

  const [tileDataMap, setTileDataMap] = useState<Record<string, FeatureCollection>>({});
  const tileCacheRef = useRef<Map<string, FeatureCollection>>(new Map());

  useEffect(() => {
    for (const el of enabledLayers) {
      const timeParam = computeTimeParam(el.meta.timelineConfig, currentYear);
      const cacheKey = timeParam !== undefined ? `${el.layerId}:${timeParam}` : el.layerId;

      const cached = tileCacheRef.current.get(cacheKey);
      if (cached) {
        setTileDataMap((prev) => (prev[el.layerId] === cached ? prev : { ...prev, [el.layerId]: cached }));
        continue;
      }

      const url = timeParam !== undefined
        ? `/api/tiles/${el.layerId}/0/0/0?time=${timeParam}`
        : `/api/tiles/${el.layerId}/0/0/0`;

      fetch(url)
        .then((res) => { if (!res.ok) throw new Error(`${res.status}`); return res.json() as Promise<FeatureCollection>; })
        .then((data) => {
          tileCacheRef.current.set(cacheKey, data);
          setTileDataMap((prev) => ({ ...prev, [el.layerId]: data }));
        })
        .catch(() => { /* no data for this time — keep previous */ });
    }
  }, [enabledLayers, currentYear]);

  const layerGeoJSON: Record<string, FeatureCollection> = useMemo(() => {
    const result: Record<string, FeatureCollection> = {};
    for (const el of enabledLayers) {
      const d = tileDataMap[el.layerId];
      if (d) result[el.layerId] = d;
    }
    return result;
  }, [enabledLayers, tileDataMap]);

  // -----------------------------------------------------------------------
  // Viewport → tile loading pipeline
  // -----------------------------------------------------------------------

  const handleViewportChange = useCallback(
    (viewport: Viewport) => {
      viewportRef.current = viewport;
      if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current);

      debounceTimerRef.current = setTimeout(() => {
        const vp = viewportRef.current;
        if (!vp) return;
        memoryManagerRef.current.evictOutOfViewport(vp);
        const { visibleTiles } = vp;
        if (visibleTiles.length === 0) return;

        const centerLat = visibleTiles.reduce((s, t) => {
          const n = 1 << t.z;
          return s + (Math.atan(Math.sinh(Math.PI * (1 - (2 * (t.y + 0.5)) / n))) * 180) / Math.PI;
        }, 0) / visibleTiles.length;
        const centerLng = visibleTiles.reduce((s, t) => {
          const n = 1 << t.z;
          return s + ((t.x + 0.5) / n) * 360 - 180;
        }, 0) / visibleTiles.length;

        for (const el of enabledLayers) {
          tileLoaderRef.current.loadTiles(el.layerId, visibleTiles, { lat: centerLat, lng: centerLng });
        }
      }, VIEWPORT_DEBOUNCE_MS);
    },
    [enabledLayers],
  );

  useEffect(() => () => { if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current); }, []);

  // -----------------------------------------------------------------------
  // Layer group slider → TransitionEngine
  // -----------------------------------------------------------------------

  const handleGroupSliderChange = useCallback(
    (groupId: string, position: number) => {
      setLayerGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, currentPosition: position } : g)));
      const group = layerGroups.find((g) => g.id === groupId);
      if (!group) return;
      let objRefs = objectRefsRef.current.get(groupId);
      if (!objRefs) { objRefs = new Map<string, ObjectReference[]>(); objectRefsRef.current.set(groupId, objRefs); }
      const sequences = buildKeyframes({ ...group, currentPosition: position }, objRefs);
      setInterpolatedObjects(interpolate(sequences, position));
    },
    [layerGroups],
  );

  // -----------------------------------------------------------------------
  // View reset
  // -----------------------------------------------------------------------

  const handleResetOrientation = useCallback(() => globeRef.current?.resetOrientation(), []);
  const handleResetZoom = useCallback(() => globeRef.current?.resetZoom(), []);

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
        />
      }
      layerPanel={
        <LayerManager
          layers={layers}
          layerGroups={layerGroups}
          onLayerToggle={handleLayerToggle}
          onGroupSliderChange={handleGroupSliderChange}
          currentYear={currentYear}
          onCurrentYearChange={setCurrentYear}
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
