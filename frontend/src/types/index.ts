/**
 * Shared TypeScript interfaces and types for the Vector Globe Viewer frontend.
 *
 * These types define the core data structures used across all frontend modules:
 * Globe_Renderer, Layer_Manager, Memory_Manager, and Transition_Engine.
 */

import type { FeatureCollection } from './geojson';

// ---------------------------------------------------------------------------
// Viewport & Spatial Types
// ---------------------------------------------------------------------------

/** Quaternion representing a 3D rotation (unit quaternion). */
export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

/** Current viewport state of the globe. */
export interface Viewport {
  /** Current rotation orientation (unit quaternion). */
  quaternion: Quaternion;
  /** Current zoom level within [minZoom, maxZoom]. */
  zoom: number;
  /** Tile coordinates currently visible in the viewport. */
  visibleTiles: TileCoord[];
}

/** Tile coordinate in the z/x/y tiling scheme. */
export interface TileCoord {
  /** Zoom level. */
  z: number;
  /** Tile column index. */
  x: number;
  /** Tile row index. */
  y: number;
}

// ---------------------------------------------------------------------------
// Layer & Layer Group Metadata
// ---------------------------------------------------------------------------

/** Configuration for a layer's timeline slider. */
export interface TimelineConfig {
  /** Minimum value of the timeline (e.g. start timestamp or 0 Ma). */
  min: number;
  /** Maximum value of the timeline (e.g. end timestamp or 300 Ma). */
  max: number;
  /** Step size for the slider (0 for continuous). */
  step: number;
  /** Unit label for display (e.g. 'Ma', 'year'). */
  unit: string;
  /** Whether the slider direction is reversed (e.g. geological time goes right-to-left). */
  reversed?: boolean;
  /** Format function name — used to pick the right display formatter. */
  formatType: 'geological' | 'historical';
}

/** Metadata for a single vector data layer. */
export interface LayerMeta {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  /** Available LOD levels for this layer. */
  lodLevels: number[];
  /** Optional timeline configuration — if present, a slider is shown for this layer. */
  timelineConfig?: TimelineConfig;
}

/** Metadata for a group of related layers (e.g. historical time series). */
export interface LayerGroupMeta {
  id: string;
  name: string;
  /** Layers in this group, ordered by position. */
  layers: LayerMeta[];
  /** Current slider position in [0, layers.length - 1]. */
  currentPosition: number;
}

// ---------------------------------------------------------------------------
// Tile Cache Types
// ---------------------------------------------------------------------------

/**
 * Cache key for a tile: `layerId:z:x:y`.
 *
 * Template literal type ensures compile-time format safety.
 */
export type TileCacheKey = `${string}:${number}:${number}:${number}`;

/** Cached tile data including the GeoJSON payload and bookkeeping metadata. */
export interface TileData {
  key: TileCacheKey;
  geojson: FeatureCollection;
  /** Size of the tile data in bytes (used for memory accounting). */
  sizeBytes: number;
  /** Timestamp of the last access (used for LRU eviction). */
  lastAccessTime: number;
}

// ---------------------------------------------------------------------------
// Object & Transition Types
// ---------------------------------------------------------------------------

/** A reference to an Object within a specific layer. */
export interface ObjectReference {
  objectId: string;
  layerId: string;
  properties: Record<string, number | string>;
  latitude: number;
  longitude: number;
}

/** A single keyframe capturing an Object's state at a specific layer index. */
export interface Keyframe {
  /** Index position within the layer group. */
  layerIndex: number;
  latitude: number;
  longitude: number;
  properties: Record<string, number | string>;
}

/** Ordered sequence of keyframes for a single Object across a layer group. */
export interface KeyframeSequence {
  objectId: string;
  /** Keyframes sorted by layerIndex. */
  keyframes: Keyframe[];
  /** Layer index where this Object first appears. */
  firstIndex: number;
  /** Layer index where this Object last appears. */
  lastIndex: number;
}

/** Result of interpolating an Object's properties at a given slider position. */
export interface InterpolatedObject {
  objectId: string;
  latitude: number;
  longitude: number;
  properties: Record<string, number | string>;
  /** Opacity in [0, 1] — used for fade-in / fade-out at object boundaries. */
  opacity: number;
}

// ---------------------------------------------------------------------------
// Enabled Layer (used by GlobeRendererProps)
// ---------------------------------------------------------------------------

/** An enabled layer paired with its metadata, passed to the Globe_Renderer. */
export interface EnabledLayer {
  layerId: string;
  meta: LayerMeta;
}

// ---------------------------------------------------------------------------
// Application State Models
// ---------------------------------------------------------------------------

/** Runtime state for a single layer. */
export interface LayerState {
  meta: LayerMeta;
  enabled: boolean;
  loadedTiles: Set<TileCacheKey>;
  loadingTiles: Set<TileCacheKey>;
}

/** Runtime state for a layer group including interpolation data. */
export interface LayerGroupState {
  meta: LayerGroupMeta;
  sliderPosition: number;
  keyframeSequences: KeyframeSequence[];
}
