/**
 * useZoom — Smooth zoom hook for the globe via mouse wheel and pinch gestures.
 *
 * Handles `wheel` events for desktop scroll zoom and touch pointer events for
 * mobile pinch-to-zoom. The zoom level is clamped to [minZoom, maxZoom] and
 * smoothly interpolated toward the target each frame using lerp.
 *
 * Requirements: 3.1 (desktop scroll zoom), 3.2 (mobile pinch zoom),
 *               3.3 (zoom clamping), 9.4 (touch gesture support)
 */

import { useRef, useCallback, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default minimum zoom level. */
export const DEFAULT_MIN_ZOOM = 1;

/** Default maximum zoom level. */
export const DEFAULT_MAX_ZOOM = 10;

/** Default starting zoom level. */
export const DEFAULT_ZOOM = 2.8;

/** How much one "click" of the wheel changes the target zoom. */
const WHEEL_ZOOM_SPEED = 0.001;

/** Lerp factor per frame for smooth zoom animation (0 = no movement, 1 = instant). */
const ZOOM_LERP_FACTOR = 8;

/** Threshold below which we snap to the target (avoids endless micro-lerps). */
const SNAP_THRESHOLD = 0.0005;

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit / property testing)
// ---------------------------------------------------------------------------

/**
 * Clamp a value to the inclusive range [min, max].
 *
 * For any input (including ±Infinity and NaN), the result is always within
 * [min, max]. NaN inputs are treated as `min` to guarantee the invariant.
 */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Linear interpolation between `a` and `b` by factor `t`.
 *
 * t = 0 → a, t = 1 → b.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Apply a zoom delta to the current zoom level, clamping the result.
 *
 * This is the core zoom-update function. No matter how large or small the
 * delta, the returned value is always within [minZoom, maxZoom].
 */
export function applyZoomDelta(
  currentZoom: number,
  delta: number,
  minZoom: number,
  maxZoom: number,
): number {
  return clamp(currentZoom + delta, minZoom, maxZoom);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseZoomOptions {
  /** Minimum allowed zoom level (default 1). */
  minZoom?: number;
  /** Maximum allowed zoom level (default 10). */
  maxZoom?: number;
  /** Initial zoom level (default 2.8). */
  initialZoom?: number;
}

export interface UseZoomReturn {
  /** Current (smoothly interpolated) zoom level. */
  zoom: number;
  /** Target zoom level that we're animating toward. */
  targetZoom: number;
  /** Attach this to the canvas container's `onWheel` handler. */
  onWheel: (e: WheelEvent) => void;
  /** Reset zoom to the initial value. */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * React hook providing smooth zoom for the globe.
 *
 * Must be called inside a react-three-fiber `<Canvas>` context (uses `useFrame`
 * for smooth animation).
 *
 * Desktop: attach `onWheel` to the canvas container element.
 * Mobile: pinch gestures are handled automatically via pointer events.
 */
export function useZoom(options: UseZoomOptions = {}): UseZoomReturn {
  const {
    minZoom = DEFAULT_MIN_ZOOM,
    maxZoom = DEFAULT_MAX_ZOOM,
    initialZoom = DEFAULT_ZOOM,
  } = options;

  // Current smoothly-interpolated zoom (what the camera actually uses)
  const zoomRef = useRef(clamp(initialZoom, minZoom, maxZoom));
  // Target zoom that we lerp toward
  const targetZoomRef = useRef(clamp(initialZoom, minZoom, maxZoom));

  // --- Pinch gesture tracking ---
  // We track two active pointers and compute distance changes.
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastPinchDistRef = useRef<number | null>(null);

  // -----------------------------------------------------------------------
  // Wheel handler (desktop)
  // -----------------------------------------------------------------------

  const onWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      // deltaY > 0 means scroll down → zoom out (increase distance / decrease zoom)
      // We invert so scroll-up = zoom in (higher zoom value = closer)
      const delta = -e.deltaY * WHEEL_ZOOM_SPEED;
      targetZoomRef.current = clamp(
        targetZoomRef.current + delta,
        minZoom,
        maxZoom,
      );
    },
    [minZoom, maxZoom],
  );

  // -----------------------------------------------------------------------
  // Pinch gesture handlers (mobile) — attached to window via useEffect
  // -----------------------------------------------------------------------

  const handlePointerDown = useCallback((e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }, []);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      const pointers = pointersRef.current;
      if (!pointers.has(e.pointerId)) return;

      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // Need exactly 2 fingers for pinch
      if (pointers.size !== 2) {
        lastPinchDistRef.current = null;
        return;
      }

      const pts = Array.from(pointers.values());
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (lastPinchDistRef.current !== null) {
        // Positive distDelta = fingers moving apart = zoom in
        const distDelta = dist - lastPinchDistRef.current;
        const zoomDelta = distDelta * 0.01; // scale factor for pinch sensitivity
        targetZoomRef.current = clamp(
          targetZoomRef.current + zoomDelta,
          minZoom,
          maxZoom,
        );
      }

      lastPinchDistRef.current = dist;
    },
    [minZoom, maxZoom],
  );

  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) {
      lastPinchDistRef.current = null;
    }
  }, []);

  // Register global pointer listeners for pinch (touch only)
  useEffect(() => {
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [handlePointerDown, handlePointerMove, handlePointerUp]);

  // -----------------------------------------------------------------------
  // Smooth zoom animation (runs every frame)
  // -----------------------------------------------------------------------

  useFrame((_state, delta) => {
    const current = zoomRef.current;
    const target = targetZoomRef.current;

    if (Math.abs(target - current) < SNAP_THRESHOLD) {
      zoomRef.current = target;
      return;
    }

    // Framerate-independent lerp: factor = 1 - e^(-speed * dt)
    const t = 1 - Math.exp(-ZOOM_LERP_FACTOR * delta);
    zoomRef.current = lerp(current, target, t);
  });

  // -----------------------------------------------------------------------
  // Reset
  // -----------------------------------------------------------------------

  const reset = useCallback(() => {
    const clamped = clamp(initialZoom, minZoom, maxZoom);
    zoomRef.current = clamped;
    targetZoomRef.current = clamped;
    lastPinchDistRef.current = null;
    pointersRef.current.clear();
  }, [initialZoom, minZoom, maxZoom]);

  // -----------------------------------------------------------------------
  // Return
  // -----------------------------------------------------------------------

  return {
    zoom: zoomRef.current,
    targetZoom: targetZoomRef.current,
    onWheel,
    reset,
  };
}
