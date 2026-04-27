/**
 * GlobeRenderer — Renders a transparent 3D globe with Fresnel-based transparency
 * and latitude/longitude grid lines using react-three-fiber and a custom ShaderMaterial.
 *
 * Requirements: 1.1 (transparent globe), 1.2 (lat/lng grid), 1.3 (≥30fps)
 */

import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { EnabledLayer, InterpolatedObject, Viewport } from '../types';
import { useArcballRotation } from '../hooks/useArcballRotation';
import { useZoom, DEFAULT_MIN_ZOOM, DEFAULT_MAX_ZOOM, DEFAULT_ZOOM } from '../hooks/useZoom';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GlobeRendererProps {
  layers: EnabledLayer[];
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

function GlobeCanvas() {
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
        <GlobeMeshWithWheel containerRef={containerRef} />
      </Canvas>
    </div>
  );
}

/**
 * Wrapper around GlobeMesh that attaches the wheel handler to the container.
 */
function GlobeMeshWithWheel({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { state, handlers } = useArcballRotation();
  const { zoom, onWheel } = useZoom({
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
      meshRef.current.quaternion.copy(state.quaternion);
    }
    // Adjust camera distance based on current zoom level
    camera.position.z = zoomToCameraDistance(zoom);
  });

  return (
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
  );
}

// ---------------------------------------------------------------------------
// Public Component
// ---------------------------------------------------------------------------

export default function GlobeRenderer({
  // Props are accepted for future wiring; currently the core globe renders
  // the transparent sphere with grid lines.
  layers: _layers,
  interpolatedObjects: _interpolatedObjects,
  onViewportChange: _onViewportChange,
}: GlobeRendererProps) {
  return <GlobeCanvas />;
}
