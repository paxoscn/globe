/**
 * useArcballRotation — Quaternion-based arcball rotation hook for the globe.
 *
 * Projects pointer coordinates onto a virtual sphere and computes incremental
 * rotation quaternions using the arcball algorithm. Supports both mouse drag
 * (desktop) and single-finger touch (mobile) via the Pointer Events API.
 *
 * On drag release, applies exponential inertia decay based on the angular
 * velocity from the last few frames, so the globe coasts to a smooth stop.
 *
 * Requirements: 2.1 (desktop drag rotation), 2.2 (mobile touch rotation),
 *               2.3 (smooth rotation through poles), 2.4 (inertia on release)
 */

import { useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ArcballRotationState {
  /** Current orientation quaternion (always unit-length). */
  quaternion: THREE.Quaternion;
  /** Whether a drag is currently in progress. */
  isDragging: boolean;
}

export interface ArcballHandlers {
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
  onPointerMove: (e: ThreeEvent<PointerEvent>) => void;
  onPointerUp: (e: ThreeEvent<PointerEvent>) => void;
}

export interface UseArcballRotationReturn {
  /** Current rotation state. */
  state: ArcballRotationState;
  /** Event handlers to attach to the globe mesh. */
  handlers: ArcballHandlers;
  /** Reset orientation to identity quaternion. */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Inertia configuration
// ---------------------------------------------------------------------------

/** Number of recent pointer samples to keep for velocity estimation. */
const VELOCITY_SAMPLE_COUNT = 5;

/** Exponential decay factor applied per second (0 = instant stop, 1 = no decay). */
const DECAY_FACTOR_PER_SECOND = 0.05;

/** Angular speed threshold below which inertia stops (radians/s). */
const MIN_ANGULAR_SPEED = 0.001;

/** A single timestamped pointer sample used for velocity estimation. */
interface PointerSample {
  nx: number;
  ny: number;
  time: number; // performance.now() in ms
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Project a 2D normalised-device-coordinate point onto the arcball sphere.
 *
 * If the point is inside the sphere's projection (x²+y² ≤ 1), we compute z
 * from the sphere equation. Otherwise we normalise onto the sphere's equator.
 * This ensures smooth, continuous rotation even when the pointer moves outside
 * the sphere — critical for pole traversal (Requirement 2.3).
 */
function projectToSphere(x: number, y: number): THREE.Vector3 {
  const lengthSq = x * x + y * y;

  if (lengthSq <= 1.0) {
    // Point is inside the sphere projection — compute z on the sphere surface
    return new THREE.Vector3(x, y, Math.sqrt(1.0 - lengthSq));
  }

  // Point is outside — project onto the sphere's equator (z = 0)
  const invLen = 1.0 / Math.sqrt(lengthSq);
  return new THREE.Vector3(x * invLen, y * invLen, 0);
}

/**
 * Convert a ThreeEvent pointer position to normalised coordinates in [-1, 1].
 *
 * Uses the event's target element (the canvas) dimensions so the mapping is
 * independent of CSS layout.
 */
function pointerToNDC(e: ThreeEvent<PointerEvent>): { nx: number; ny: number } {
  const rect = (e.nativeEvent.target as HTMLElement)?.getBoundingClientRect?.();
  if (!rect || rect.width === 0 || rect.height === 0) {
    return { nx: 0, ny: 0 };
  }

  const nx = ((e.nativeEvent.clientX - rect.left) / rect.width) * 2 - 1;
  // Flip Y so that up is positive (matches Three.js convention)
  const ny = -(((e.nativeEvent.clientY - rect.top) / rect.height) * 2 - 1);

  return { nx, ny };
}

/**
 * Compute the rotation quaternion that rotates vector `from` to vector `to`.
 *
 * Both vectors are assumed to be unit-length (on the arcball sphere).
 * The rotation axis is their cross product and the angle comes from the dot
 * product. The result is always a unit quaternion.
 */
function rotationBetweenVectors(from: THREE.Vector3, to: THREE.Vector3): THREE.Quaternion {
  const axis = new THREE.Vector3().crossVectors(from, to);
  const dot = from.dot(to);

  // Handle near-parallel vectors (no rotation needed)
  if (axis.lengthSq() < 1e-10) {
    return new THREE.Quaternion(0, 0, 0, 1);
  }

  // Build quaternion: (sin(θ/2) * axis, cos(θ/2))
  // Using the identity: q = (from × to, from · to + |from × to|)  normalised
  // which avoids explicit trig calls.
  const q = new THREE.Quaternion(axis.x, axis.y, axis.z, 1.0 + dot);
  q.normalize();
  return q;
}

/**
 * Compute the angular velocity (as an axis-angle rotation quaternion per second)
 * from a ring buffer of recent pointer samples.
 *
 * Returns the rotation quaternion representing the angular velocity, and the
 * angular speed in radians/second. If there aren't enough samples or the time
 * span is too short, returns null.
 */
export function computeAngularVelocity(
  samples: PointerSample[],
  sensitivity: number,
): { axis: THREE.Vector3; speed: number } | null {
  if (samples.length < 2) return null;

  // Use the oldest and newest samples for a stable velocity estimate
  const oldest = samples[0];
  const newest = samples[samples.length - 1];
  const dtMs = newest.time - oldest.time;

  // Need at least 10ms of data to compute a meaningful velocity
  if (dtMs < 10) return null;

  const dtSec = dtMs / 1000;

  // Project both points onto the arcball sphere
  const fromVec = projectToSphere(oldest.nx * sensitivity, oldest.ny * sensitivity);
  const toVec = projectToSphere(newest.nx * sensitivity, newest.ny * sensitivity);

  // Compute the rotation between the two sphere points
  const axis = new THREE.Vector3().crossVectors(fromVec, toVec);
  const axisLen = axis.length();

  if (axisLen < 1e-10) return null;

  // The angle between the two vectors
  const dot = THREE.MathUtils.clamp(fromVec.dot(toVec), -1, 1);
  const angle = Math.acos(dot);

  // Angular speed = angle / time
  const speed = angle / dtSec;

  if (speed < MIN_ANGULAR_SPEED) return null;

  // Normalise the axis
  axis.normalize();

  return { axis, speed };
}

/**
 * Apply exponential decay to an angular speed value.
 *
 * The decay follows: speed(t) = speed₀ × decayFactor^t
 * where t is in seconds. This guarantees monotonically decreasing speed.
 */
export function decaySpeed(currentSpeed: number, deltaSeconds: number): number {
  // decayFactor^deltaSeconds gives the multiplicative reduction
  const factor = Math.pow(DECAY_FACTOR_PER_SECOND, deltaSeconds);
  return currentSpeed * factor;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * React hook providing arcball rotation for a Three.js mesh.
 *
 * Attach the returned `handlers` to the mesh's pointer event props.
 * Read `state.quaternion` to apply the current orientation.
 *
 * Must be called inside a react-three-fiber `<Canvas>` context (uses `useFrame`
 * for inertia animation).
 *
 * @param sensitivity  Multiplier for rotation speed (default 1.0).
 */
export function useArcballRotation(sensitivity = 1.0): UseArcballRotationReturn {
  // Persistent rotation state (refs to avoid re-renders on every pointer move)
  const quaternionRef = useRef(new THREE.Quaternion());
  const isDraggingRef = useRef(false);

  // Drag-session bookkeeping
  const startVecRef = useRef(new THREE.Vector3());
  const dragStartQuatRef = useRef(new THREE.Quaternion());
  const activePointerRef = useRef<number | null>(null);

  // Velocity tracking: ring buffer of recent pointer samples
  const pointerSamplesRef = useRef<PointerSample[]>([]);

  // Inertia state
  const inertiaAxisRef = useRef(new THREE.Vector3());
  const inertiaSpeedRef = useRef(0); // radians per second

  // -----------------------------------------------------------------------
  // Pointer handlers
  // -----------------------------------------------------------------------

  const onPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      // Only track one pointer at a time (first finger / left mouse button)
      if (isDraggingRef.current) return;

      // For mouse, only respond to primary button
      if (e.nativeEvent.pointerType === 'mouse' && e.nativeEvent.button !== 0) return;

      isDraggingRef.current = true;
      activePointerRef.current = e.nativeEvent.pointerId;

      // Stop any ongoing inertia
      inertiaSpeedRef.current = 0;

      // Capture the pointer so we keep receiving events even outside the element
      (e.nativeEvent.target as HTMLElement)?.setPointerCapture?.(e.nativeEvent.pointerId);

      // Record the starting sphere-projected point and current quaternion
      const { nx, ny } = pointerToNDC(e);
      startVecRef.current = projectToSphere(nx * sensitivity, ny * sensitivity);
      dragStartQuatRef.current = quaternionRef.current.clone();

      // Reset velocity samples and record the first sample
      pointerSamplesRef.current = [{ nx, ny, time: performance.now() }];

      e.stopPropagation();
    },
    [sensitivity],
  );

  const onPointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!isDraggingRef.current) return;
      if (e.nativeEvent.pointerId !== activePointerRef.current) return;

      const { nx, ny } = pointerToNDC(e);
      const currentVec = projectToSphere(nx * sensitivity, ny * sensitivity);

      // Incremental rotation from start position to current position
      const incrementalQuat = rotationBetweenVectors(startVecRef.current, currentVec);

      // New orientation = incremental * dragStart  (pre-multiply)
      const newQuat = new THREE.Quaternion().multiplyQuaternions(
        incrementalQuat,
        dragStartQuatRef.current,
      );

      // Re-normalise to guard against floating-point drift (Property 1)
      newQuat.normalize();

      quaternionRef.current = newQuat;

      // Record pointer sample for velocity estimation (keep last N samples)
      const samples = pointerSamplesRef.current;
      samples.push({ nx, ny, time: performance.now() });
      if (samples.length > VELOCITY_SAMPLE_COUNT) {
        samples.shift();
      }

      e.stopPropagation();
    },
    [sensitivity],
  );

  const onPointerUp = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (e.nativeEvent.pointerId !== activePointerRef.current) return;

      // Compute angular velocity from recent pointer samples before clearing state
      const velocity = computeAngularVelocity(pointerSamplesRef.current, sensitivity);
      if (velocity) {
        inertiaAxisRef.current.copy(velocity.axis);
        inertiaSpeedRef.current = velocity.speed;
      }

      isDraggingRef.current = false;
      activePointerRef.current = null;
      pointerSamplesRef.current = [];

      // Release pointer capture
      (e.nativeEvent.target as HTMLElement)?.releasePointerCapture?.(e.nativeEvent.pointerId);

      e.stopPropagation();
    },
    [sensitivity],
  );

  // -----------------------------------------------------------------------
  // Inertia animation (runs every frame via react-three-fiber)
  // -----------------------------------------------------------------------

  useFrame((_state, delta) => {
    if (isDraggingRef.current) return;
    if (inertiaSpeedRef.current < MIN_ANGULAR_SPEED) {
      inertiaSpeedRef.current = 0;
      return;
    }

    // Apply rotation: rotate by (axis, speed * delta) around the inertia axis
    const angle = inertiaSpeedRef.current * delta;
    const inertiaQuat = new THREE.Quaternion().setFromAxisAngle(
      inertiaAxisRef.current,
      angle,
    );

    // Pre-multiply: new orientation = inertiaRotation * currentOrientation
    const newQuat = new THREE.Quaternion().multiplyQuaternions(
      inertiaQuat,
      quaternionRef.current,
    );
    newQuat.normalize();
    quaternionRef.current = newQuat;

    // Exponential decay: speed monotonically decreases toward zero
    inertiaSpeedRef.current = decaySpeed(inertiaSpeedRef.current, delta);
  });

  // -----------------------------------------------------------------------
  // Reset
  // -----------------------------------------------------------------------

  const reset = useCallback(() => {
    quaternionRef.current = new THREE.Quaternion();
    isDraggingRef.current = false;
    activePointerRef.current = null;
    inertiaSpeedRef.current = 0;
    pointerSamplesRef.current = [];
  }, []);

  // -----------------------------------------------------------------------
  // Return value
  // -----------------------------------------------------------------------

  return {
    state: {
      quaternion: quaternionRef.current,
      isDragging: isDraggingRef.current,
    },
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
    },
    reset,
  };
}

// Export helpers for unit testing
export { projectToSphere, rotationBetweenVectors };
