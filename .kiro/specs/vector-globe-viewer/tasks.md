# Implementation Plan: Vector Globe Viewer

## Overview

本实现计划将交互式透明球体矢量数据可视化应用拆分为增量式编码任务。前端使用 React + react-three-fiber + TypeScript，后端使用 Rust + Axum + SeaORM。每个任务构建在前一个任务之上，确保无孤立代码。属性测试覆盖设计文档中定义的 15 个正确性属性。

## Tasks

- [x] 1. Initialize project structure and shared types
  - [x] 1.1 Set up frontend project with Vite + React + TypeScript
    - Initialize Vite project with React-TS template
    - Install dependencies: `react-three-fiber`, `three`, `@types/three`, `@react-three/drei`
    - Install test dependencies: `vitest`, `fast-check`, `@testing-library/react`, `jsdom`
    - Configure `vitest.config.ts` with jsdom environment
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 Set up backend project with Rust + Axum + SeaORM
    - Create Rust workspace with `cargo init`
    - Add dependencies: `axum`, `sea-orm`, `serde`, `serde_json`, `tokio`, `tower`, `tower-http` (cors, compression)
    - Add test dependencies: `proptest`, `tokio-test`
    - Configure `Cargo.toml` with appropriate features
    - _Requirements: 10.1_

  - [x] 1.3 Define shared TypeScript interfaces and types for frontend
    - Create `src/types/index.ts` with all interfaces: `Viewport`, `TileCoord`, `LayerMeta`, `LayerGroupMeta`, `TileCacheKey`, `TileData`, `ObjectReference`, `Keyframe`, `KeyframeSequence`, `InterpolatedObject`, `EnabledLayer`
    - Create `src/types/geojson.ts` with GeoJSON type definitions
    - _Requirements: 5.1, 10.4, 11.1_

  - [x] 1.4 Define backend data models with SeaORM entities
    - Create entity files for `layers`, `layer_groups`, `tiles`, `objects`, `object_references` tables
    - Define relationships between entities (layer → group, tile → layer, object_reference → object/layer)
    - Add unique index on `(layer_id, z, x, y)` for tiles table
    - Add index on `(layer_id, object_id)` for object_references table
    - _Requirements: 10.1, 10.3_

- [x] 2. Implement Globe_Renderer core with transparent sphere and grid
  - [x] 2.1 Create transparent globe with custom ShaderMaterial
    - Create `src/components/GlobeRenderer.tsx` with react-three-fiber `Canvas`
    - Write vertex shader for standard sphere vertex transformation
    - Write fragment shader with Fresnel-based transparency and lat/lng grid lines
    - Render a `SphereGeometry` with the custom `ShaderMaterial`
    - Ensure rendering at ≥30fps
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 2.2 Implement quaternion-based arcball rotation
    - Create `src/hooks/useArcballRotation.ts`
    - Capture `pointerdown` to record start point and current quaternion
    - On `pointermove`, compute incremental rotation quaternion via arcball sphere projection
    - Multiply incremental quaternion with current quaternion for new orientation
    - Support both mouse drag (desktop) and single-finger touch (mobile)
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 2.3 Write property test: Quaternion rotation composition preserves unit norm
    - **Property 1: Quaternion rotation composition preserves unit norm**
    - Generate random drag sequences (dx, dy pairs), apply arcball rotation composition, assert ‖q‖ ≈ 1
    - **Validates: Requirements 2.1, 2.2**

  - [ ]* 2.4 Write property test: Quaternion slerp continuity through poles
    - **Property 2: Quaternion slerp continuity through poles**
    - Generate random quaternion pairs (including polar orientations) and random t ∈ [0,1], assert slerp produces valid unit quaternions with no discontinuities
    - **Validates: Requirements 2.3**

  - [x] 2.5 Implement inertia rotation on drag release
    - Extend `useArcballRotation.ts` to track angular velocity from last few frames
    - On `pointerup`, apply exponential decay animation using `useFrame`
    - Ensure angular speed monotonically decreases to zero
    - _Requirements: 2.4_

  - [ ]* 2.6 Write property test: Inertia decay convergence
    - **Property 3: Inertia decay convergence**
    - Generate random initial angular velocity vectors, assert decay is monotonically decreasing and converges to zero
    - **Validates: Requirements 2.4**

- [x] 3. Implement zoom interaction and LOD mapping
  - [x] 3.1 Implement zoom with mouse wheel and pinch gesture
    - Create `src/hooks/useZoom.ts`
    - Handle `wheel` events for desktop scroll zoom
    - Handle touch `gesturechange` / pointer events for mobile pinch zoom
    - Clamp zoom to `[minZoom, maxZoom]` range
    - Apply smooth zoom animation
    - _Requirements: 3.1, 3.2, 3.3, 9.4_

  - [ ]* 3.2 Write property test: Zoom clamping invariant
    - **Property 4: Zoom clamping invariant**
    - Generate random zoom deltas (including extreme values), assert result always within [minZoom, maxZoom]
    - **Validates: Requirements 3.3**

  - [x] 3.3 Implement zoom-to-LOD mapping function
    - Create `src/utils/lodMapping.ts` with `zoomToLod(zoom: number): number`
    - Map zoom ranges: z=0–3 → LOD 0, z=4–6 → LOD 1, z=7+ → LOD 2
    - Ensure monotonically non-decreasing mapping
    - _Requirements: 3.4, 6.2, 7.1_

  - [ ]* 3.4 Write property test: Zoom-to-LOD mapping correctness
    - **Property 5: Zoom-to-LOD mapping correctness**
    - Generate random zoom levels within valid range, assert correct LOD bracket and monotonically non-decreasing mapping
    - **Validates: Requirements 3.4, 6.2**

- [x] 4. Implement view reset controls
  - [x] 4.1 Add reset orientation and reset zoom buttons
    - Create `src/components/ViewControls.tsx` with "回正" and "重置缩放" buttons
    - Implement smooth animated quaternion slerp back to default orientation
    - Implement smooth animated zoom interpolation back to default zoom
    - Position buttons as always-visible overlay on the globe
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 5. Checkpoint - Core globe rendering and interaction
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement Memory_Manager with LRU cache
  - [x] 6.1 Implement LRU cache with memory limit
    - Create `src/services/MemoryManager.ts`
    - Use `Map` insertion-order for LRU: delete-and-reinsert on access, evict first entry
    - Track total memory usage via `sizeBytes` on each `TileData`
    - Configure memory limits: 256MB desktop, 128MB mobile (detect via `navigator.maxTouchPoints` or screen width)
    - Implement `get`, `put`, `evictOutOfViewport`, `getMemoryUsage` methods
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 6.2 Write property test: LRU cache memory limit and eviction correctness
    - **Property 10: LRU cache memory limit and eviction correctness**
    - Generate random tile insertion/access sequences, assert total memory never exceeds limit and evicted tile is always the oldest-accessed
    - **Validates: Requirements 8.2, 8.3**

- [x] 7. Implement Layer_Manager UI
  - [x] 7.1 Create layer list sidebar component (desktop) and bottom drawer (mobile)
    - Create `src/components/LayerManager.tsx`
    - Render layer list with toggle switches for enable/disable
    - Render layer groups with expandable sections
    - Use CSS media queries or `useMediaQuery` hook for responsive layout
    - Desktop: sidebar panel; Mobile: collapsible bottom drawer
    - _Requirements: 5.1, 5.2, 5.3, 9.2, 9.3_

  - [x] 7.2 Implement layer enable/disable logic with state management
    - Create `src/hooks/useLayerState.ts` to manage layer enabled/disabled state
    - Support toggling individual layers on/off
    - Ensure idempotent enable/disable operations
    - Track active layers set
    - _Requirements: 5.2, 5.3, 5.4_

  - [ ]* 7.3 Write property test: Layer enable/disable set correctness
    - **Property 6: Layer enable/disable set correctness**
    - Generate random layer subsets and random toggle operation sequences, assert active set matches expected and operations are idempotent
    - **Validates: Requirements 5.4**

  - [x] 7.4 Implement layer group slider control
    - Add slider component inside expanded layer group sections
    - Slider range: `[0, layers.length - 1]` with continuous values for interpolation
    - Emit `onGroupSliderChange` with group ID and position
    - _Requirements: 5.5, 5.6_

- [x] 8. Implement backend Tile_Service and API routes
  - [x] 8.1 Implement Axum REST API router and middleware
    - Create `src/routes/mod.rs` with Axum router
    - Add routes: `GET /api/tiles/:layer_id/:z/:x/:y`, `GET /api/layers`, `GET /api/objects/:object_id`
    - Add `tower-http` compression middleware (gzip)
    - Add CORS middleware for frontend access
    - Add request validation for tile coordinates
    - Set response headers: `Content-Type: application/geo+json`, `Cache-Control: public, max-age=3600`
    - _Requirements: 10.2, 10.4_

  - [x] 8.2 Implement Tile_Service with spatial query
    - Create `src/services/tile_service.rs`
    - Query tiles by `(layer_id, z, x, y)` using SeaORM
    - Return GeoJSON FeatureCollection with object references embedded
    - Implement error handling: 404 for missing tiles, 400 for invalid coordinates, 504 for query timeout (5s)
    - Target response time ≤200ms
    - _Requirements: 10.2, 10.3, 10.4, 6.1_

  - [x] 8.3 Implement Layer_Service for metadata and object references
    - Create `src/services/layer_service.rs`
    - Query all layers and layer groups with their metadata
    - Query object references by layer ID
    - Return structured JSON with layer/group hierarchy
    - _Requirements: 5.1, 11.1_

  - [x] 8.4 Implement error response format and error handling middleware
    - Create standardized error response struct: `{ error: { code, message, retry_after } }`
    - Map SeaORM errors to appropriate HTTP status codes
    - Add database connection retry logic (503 on connection failure)
    - _Requirements: 6.4_

- [x] 9. Implement backend Douglas-Peucker LOD generation
  - [x] 9.1 Implement Douglas-Peucker simplification for vector data
    - Create `src/services/simplification.rs`
    - Implement Ramer-Douglas-Peucker algorithm with configurable tolerance
    - Generate LOD levels: tolerance 1.0° (LOD 0), 0.1° (LOD 1), 0.01° (LOD 2)
    - Preserve first and last points of each polyline
    - Store simplified tiles per LOD level
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ]* 9.2 Write property test (proptest): Douglas-Peucker simplification invariants
    - **Property 9: Douglas-Peucker simplification invariants**
    - Generate random polylines and positive tolerances, assert: (a) output points are subset of input, (b) output ≤ input point count, (c) first/last points preserved, (d) max perpendicular distance of omitted points ≤ tolerance
    - **Validates: Requirements 7.3**

- [x] 10. Checkpoint - Backend services and memory management
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement frontend tile loading and viewport calculation
  - [x] 11.1 Implement viewport-to-tiles calculation
    - Create `src/utils/viewportTiles.ts`
    - Given a quaternion orientation and zoom level, compute the set of visible tile coordinates
    - Ensure full coverage of visible globe area
    - _Requirements: 6.1_

  - [ ]* 11.2 Write property test (proptest): Viewport-to-tiles coverage
    - **Property 7: Viewport-to-tiles coverage**
    - Generate random quaternion orientations and zoom levels, assert computed tile set covers entire visible area and every tile has at least partial overlap
    - Note: This property is tested on the backend using proptest since the spatial logic is shared
    - **Validates: Requirements 6.1**

  - [x] 11.3 Implement tile request prioritization
    - Create `src/services/TileLoader.ts`
    - Order tile requests by ascending spherical distance from viewport center
    - Integrate with `MemoryManager` for cache-first loading
    - Implement HTTP fetch with retry logic (3 retries, exponential backoff)
    - Handle errors: show failure icon, provide retry button
    - _Requirements: 6.3, 6.4_

  - [ ]* 11.4 Write property test: Tile request priority ordering
    - **Property 8: Tile request priority ordering**
    - Generate random tile coordinate sets and viewport center points, assert request queue is ordered by ascending spherical distance from center
    - **Validates: Requirements 6.3**

  - [x] 11.5 Implement GeoJSON parsing and rendering on globe surface
    - Create `src/utils/geojsonRenderer.ts`
    - Parse GeoJSON FeatureCollection and convert coordinates to 3D positions on sphere
    - Render vector features (LineString, Polygon) as Three.js geometries on the globe surface
    - Support smooth LOD transition when zoom crosses LOD thresholds
    - _Requirements: 7.2, 10.4_

  - [ ]* 11.6 Write property test: GeoJSON serialization round-trip
    - **Property 11: GeoJSON serialization round-trip**
    - Generate random GeoJSON FeatureCollections with fast-check, assert serialize → deserialize produces equivalent output
    - **Validates: Requirements 10.4**

- [ ] 12. Implement backend GeoJSON round-trip test
  - [ ]* 12.1 Write property test (proptest): GeoJSON serialization round-trip (backend)
    - **Property 11: GeoJSON serialization round-trip (backend)**
    - Generate random GeoJSON Feature structures with proptest, assert serialize → deserialize equivalence
    - **Validates: Requirements 10.4**

- [x] 13. Implement Transition_Engine for keyframe interpolation
  - [x] 13.1 Implement keyframe sequence construction
    - Create `src/services/TransitionEngine.ts`
    - Parse object references from layer group data
    - Build `KeyframeSequence` for each object: one keyframe per layer where the object appears, ordered by layer index
    - Track `firstIndex` and `lastIndex` for each object's presence range
    - _Requirements: 11.1, 11.2, 11.3_

  - [ ]* 13.2 Write property test: Keyframe sequence construction
    - **Property 12: Keyframe sequence construction**
    - Generate random layer groups with random object references, assert each sequence has exactly one keyframe per layer where the object appears, ordered by layer index
    - **Validates: Requirements 11.2, 11.3**

  - [x] 13.3 Implement Slerp interpolation for geographic coordinates
    - Create `src/utils/slerp.ts`
    - Convert lat/lng to unit sphere 3D vectors
    - Perform spherical linear interpolation
    - Convert result back to lat/lng
    - Handle edge cases: identical points, antipodal points
    - _Requirements: 11.5_

  - [ ]* 13.4 Write property test: Slerp interpolation on geographic coordinates
    - **Property 14: Slerp interpolation on geographic coordinates**
    - Generate random lat/lng pairs and random t ∈ [0,1], assert result lies on great circle arc, t=0 returns first point, t=1 returns second point, result is always valid coordinates
    - **Validates: Requirements 11.5**

  - [x] 13.5 Implement linear interpolation for numeric properties and string switching
    - Add `lerp` function for numeric properties
    - Add string property switching logic: position < 0.5 → first value, ≥ 0.5 → second value
    - Ensure exact values at integer layer indices (no floating-point drift)
    - _Requirements: 11.4, 11.6_

  - [ ]* 13.6 Write property test: Linear interpolation correctness with exact-at-integer boundary
    - **Property 13: Linear interpolation correctness with exact-at-integer boundary**
    - Generate random keyframe pairs with numeric values and random t ∈ [0,1], assert interpolated value is between keyframe values (inclusive) and exact at integer indices
    - **Validates: Requirements 11.4, 11.6**

  - [x] 13.7 Implement fade in/out opacity for partial-range objects
    - Calculate opacity based on slider position relative to object's `firstIndex` and `lastIndex`
    - Fade in: opacity 0→1 from `firstIndex - 0.5` to `firstIndex`
    - Fade out: opacity 1→0 from `lastIndex` to `lastIndex + 0.5`
    - Full opacity (1.0) within the object's layer range
    - _Requirements: 11.7_

  - [ ]* 13.8 Write property test: Fade in/out opacity at object boundaries
    - **Property 15: Fade in/out opacity at object boundaries**
    - Generate random object layer ranges and slider positions, assert opacity is 1.0 within range, 0.0 beyond fade distance, and smoothly transitioning at boundaries
    - **Validates: Requirements 11.7**

- [x] 14. Checkpoint - Transition engine and tile loading
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Integrate all components and wire together
  - [x] 15.1 Create App root component with state management
    - Create `src/App.tsx` as root component
    - Initialize `AppState` with viewport, layers, layer groups, and tile cache
    - Fetch layer metadata from `GET /api/layers` on mount
    - Wire `GlobeRenderer`, `LayerManager`, `ViewControls` together
    - _Requirements: 1.1, 5.1_

  - [x] 15.2 Wire viewport changes to tile loading pipeline
    - Connect `onViewportChange` from `GlobeRenderer` to `TileLoader`
    - On viewport change: compute visible tiles → check cache → fetch missing tiles → render
    - Integrate `MemoryManager` eviction on viewport change
    - Debounce viewport change events to avoid excessive tile requests
    - _Requirements: 6.1, 6.3, 8.1_

  - [x] 15.3 Wire layer group slider to Transition_Engine
    - Connect `onGroupSliderChange` from `LayerManager` to `TransitionEngine`
    - On slider change: compute interpolated objects → pass to `GlobeRenderer` as `interpolatedObjects` prop
    - Ensure ≥30fps during slider interaction
    - _Requirements: 11.4, 11.5, 11.8_

  - [x] 15.4 Implement responsive layout wrapper
    - Create `src/components/Layout.tsx`
    - Desktop: globe fills main area, sidebar on the right
    - Mobile: globe fills screen, bottom drawer for layer controls
    - Auto-resize globe rendering area on window resize
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 16. Final checkpoint - Full integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate the 15 universal correctness properties defined in the design document
- Frontend property tests use `fast-check` via Vitest; backend property tests use `proptest`
- All 15 correctness properties are covered: Properties 1–6, 8, 10–15 on frontend; Properties 7, 9, 11 on backend
