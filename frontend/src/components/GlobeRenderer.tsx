/**
 * GlobeRenderer — Renders an transparent 3D globe with Fresnel-based edge glow
 * and latitude/longitude grid lines using react-three-fiber and a custom ShaderMaterial.
 *
 * Requirements: 1.1 (transparent globe), 1.2 (lat/lng grid), 1.3 (≥30fps)
 */

import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { EnabledLayer, InterpolatedObject, Viewport } from '../types';
import type { FeatureCollection } from '../types/geojson';
import { useArcballRotation } from '../hooks/useArcballRotation';
import { useZoom, DEFAULT_MIN_ZOOM, DEFAULT_MAX_ZOOM, DEFAULT_ZOOM } from '../hooks/useZoom';
import { latLngToSpherePosition } from '../utils/geojsonRenderer';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GlobeRendererProps {
  layers: EnabledLayer[];
  layerGeoJSON?: Record<string, FeatureCollection>;
  interpolatedObjects: InterpolatedObject[];
  onViewportChange: (viewport: Viewport) => void;
}

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------

const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uGlobeColor;
  uniform vec3 uGridColor;
  uniform float uGridLineWidth;
  uniform float uFresnelPower;
  uniform float uBaseOpacity;

  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  /*
   * Convert the surface point on a unit sphere to latitude/longitude (degrees).
   * We use the normalised world position (which lies on the sphere surface).
   */
  vec2 toLonLat(vec3 p) {
    vec3 n = normalize(p);
    float lat = degrees(asin(clamp(n.y, -1.0, 1.0)));
    float lon = degrees(atan(n.z, n.x));
    return vec2(lon, lat);
  }

  /*
   * Returns 1.0 when the coordinate is on a grid line, 0.0 otherwise.
   * Grid spacing is every 15° for both latitude and longitude.
   */
  float gridLine(vec2 lonLat, float lineWidth) {
    float spacingDeg = 15.0;
    vec2 grid = abs(mod(lonLat + spacingDeg * 0.5, spacingDeg) - spacingDeg * 0.5);
    // Use fwidth for screen-space anti-aliased lines
    vec2 fw = fwidth(lonLat);
    vec2 aa = smoothstep(vec2(lineWidth) - fw, vec2(lineWidth) + fw, grid);
    return 1.0 - min(aa.x, aa.y);
  }

  void main() {
    // --- Fresnel term (edge glow / transparency) ---
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float fresnel = pow(1.0 - abs(dot(viewDir, vNormal)), uFresnelPower);

    // --- Lat/Lng grid ---
    vec2 lonLat = toLonLat(vWorldPosition);
    float grid = gridLine(lonLat, uGridLineWidth);

    // Combine: base colour + grid overlay
    vec3 baseColor = uGlobeColor;
    vec3 color = mix(baseColor, uGridColor, grid * 0.8);

    // Opacity: base transparency boosted at edges (Fresnel) and on grid lines
    float alpha = uBaseOpacity + fresnel * (1.0 - uBaseOpacity) * 0.6 + grid * 0.25;
    alpha = clamp(alpha, 0.0, 1.0);

    gl_FragColor = vec4(color, alpha);
  }
`;

// ---------------------------------------------------------------------------
// Zoom-to-camera-distance mapping
// ---------------------------------------------------------------------------

/**
 * Convert a zoom level to a camera Z distance.
 *
 * Higher zoom → closer camera. We use an inverse mapping so that zoom=1
 * (minimum) gives the farthest distance and zoom=maxZoom gives the closest.
 *
 * The formula: distance = baseDist / zoom  keeps the relationship smooth and
 * monotonic. baseDist is chosen so that the default zoom (2.8) maps to the
 * original camera distance of 2.8.
 */
const BASE_CAMERA_DISTANCE = DEFAULT_ZOOM * 2.8; // ≈ 7.84

export function zoomToCameraDistance(zoom: number): number {
  return BASE_CAMERA_DISTANCE / zoom;
}

// ---------------------------------------------------------------------------
// Canvas wrapper that wires wheel events to the zoom hook
// ---------------------------------------------------------------------------

function GlobeCanvas({ layerGeoJSON }: { layerGeoJSON?: Record<string, FeatureCollection> }) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', minHeight: 400 }}
      data-testid="globe-renderer"
    >
      <Canvas
        camera={{ position: [0, 0, 2.8], fov: 50 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
        style={{ background: 'radial-gradient(ellipse at center, #0a0e27 0%, #000 100%)' }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 3, 5]} intensity={0.6} />
        <GlobeMeshWithWheel containerRef={containerRef} layerGeoJSON={layerGeoJSON} />
      </Canvas>
    </div>
  );
}

/**
 * Wrapper around GlobeMesh that attaches the wheel handler to the container.
 */
function GlobeMeshWithWheel({
  containerRef,
  layerGeoJSON,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  layerGeoJSON?: Record<string, FeatureCollection>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { refs: arcballRefs, handlers } = useArcballRotation();
  const { zoomRef, onWheel } = useZoom({
    minZoom: DEFAULT_MIN_ZOOM,
    maxZoom: DEFAULT_MAX_ZOOM,
    initialZoom: DEFAULT_ZOOM,
  });
  const { camera } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uGlobeColor: { value: new THREE.Color(0.15, 0.35, 0.65) },
      uGridColor: { value: new THREE.Color(0.5, 0.7, 1.0) },
      uGridLineWidth: { value: 0.4 },
      uFresnelPower: { value: 2.5 },
      uBaseOpacity: { value: 0.12 },
    }),
    [],
  );

  // Attach wheel listener with passive: false to the container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => onWheel(e);
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [containerRef, onWheel]);

  // Apply arcball quaternion to the mesh and adjust camera distance each frame
  useFrame((_state, delta) => {
    uniforms.uTime.value += delta;
    if (meshRef.current) {
      // Read directly from the ref to get the latest quaternion (not a stale snapshot)
      meshRef.current.quaternion.copy(arcballRefs.quaternionRef.current);
    }
    // Adjust camera distance based on current zoom level (read from ref)
    camera.position.z = zoomToCameraDistance(zoomRef.current);
  });

  // Build line geometries from GeoJSON data
  const vectorObjects = useMemo(() => {
    if (!layerGeoJSON) return [];
    const objects: THREE.Object3D[] = [];
    const SPHERE_OFFSET = 1.002; // slightly above globe surface

    for (const [_layerId, fc] of Object.entries(layerGeoJSON)) {
      for (const feature of fc.features) {
        const geom = feature.geometry;
        let coordRings: [number, number][][] = [];

        if (geom.type === 'LineString') {
          coordRings = [geom.coordinates as [number, number][]];
        } else if (geom.type === 'MultiLineString') {
          coordRings = geom.coordinates as [number, number][][];
        } else if (geom.type === 'Polygon') {
          coordRings = geom.coordinates as [number, number][][];
        } else if (geom.type === 'MultiPolygon') {
          coordRings = (geom.coordinates as [number, number][][][]).flat();
        } else if (geom.type === 'Point') {
          // Render points as small spheres
          const [lng, lat] = geom.coordinates as [number, number];
          const pos = latLngToSpherePosition(lat, lng, SPHERE_OFFSET);
          const dotGeom = new THREE.SphereGeometry(0.012, 8, 8);
          const dotMat = new THREE.MeshBasicMaterial({ color: 0xffcc33 });
          const dot = new THREE.Mesh(dotGeom, dotMat);
          dot.position.copy(pos);
          objects.push(dot);
          continue;
        } else {
          continue;
        }

        for (const ring of coordRings) {
          const pts: THREE.Vector3[] = [];
          for (const coord of ring) {
            const [lng, lat] = coord;
            pts.push(latLngToSpherePosition(lat, lng, SPHERE_OFFSET));
          }
          const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
          const lineMat = new THREE.LineBasicMaterial({ color: 0x4dff88, linewidth: 1.5 });
          const lineObj = new THREE.Line(lineGeom, lineMat);
          objects.push(lineObj);
        }
      }
    }
    return objects;
  }, [layerGeoJSON]);

  // Group ref for vector data — syncs rotation with the globe mesh
  const vectorGroupRef = useRef<THREE.Group>(null);

  // Keep vector group rotation in sync with globe
  useFrame(() => {
    if (vectorGroupRef.current && meshRef.current) {
      vectorGroupRef.current.quaternion.copy(meshRef.current.quaternion);
    }
  });

  return (
    <>
      <mesh
        ref={meshRef}
        onPointerDown={handlers.onPointerDown}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlers.onPointerUp}
      >
        <sphereGeometry args={[1, 64, 64]} />
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Vector data rendered on the globe surface */}
      <group ref={vectorGroupRef}>
        {vectorObjects.map((obj, i) => (
          <primitive key={i} object={obj} />
        ))}
      </group>
    </>
  );
}

// ---------------------------------------------------------------------------
// Public Component
// ---------------------------------------------------------------------------

export default function GlobeRenderer({
  layers: _layers,
  layerGeoJSON,
  interpolatedObjects: _interpolatedObjects,
  onViewportChange: _onViewportChange,
}: GlobeRendererProps) {
  return <GlobeCanvas layerGeoJSON={layerGeoJSON} />;
}
