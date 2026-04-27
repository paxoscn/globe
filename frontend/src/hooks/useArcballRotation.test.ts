/**
 * Unit tests for useArcballRotation hook — pure math helpers.
 *
 * We test the exported helper functions (projectToSphere, rotationBetweenVectors,
 * computeAngularVelocity, decaySpeed) directly since the hook itself requires
 * a react-three-fiber context.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  projectToSphere,
  rotationBetweenVectors,
  computeAngularVelocity,
  decaySpeed,
} from './useArcballRotation';

describe('projectToSphere', () => {
  it('projects the origin to (0, 0, 1) — top of the sphere', () => {
    const v = projectToSphere(0, 0);
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(0);
    expect(v.z).toBeCloseTo(1);
  });

  it('produces a unit-length vector for points inside the sphere', () => {
    const v = projectToSphere(0.3, 0.4);
    expect(v.length()).toBeCloseTo(1, 5);
  });

  it('produces a unit-length vector for points outside the sphere', () => {
    const v = projectToSphere(2, 3);
    expect(v.length()).toBeCloseTo(1, 5);
  });

  it('projects points on the unit circle boundary to z ≈ 0', () => {
    const v = projectToSphere(1, 0);
    expect(v.x).toBeCloseTo(1);
    expect(v.y).toBeCloseTo(0);
    expect(v.z).toBeCloseTo(0);
  });

  it('normalises far-away points onto the equator (z = 0)', () => {
    const v = projectToSphere(100, 0);
    expect(v.z).toBeCloseTo(0);
    expect(v.length()).toBeCloseTo(1, 5);
  });
});

describe('rotationBetweenVectors', () => {
  it('returns identity quaternion for identical vectors', () => {
    const v = new THREE.Vector3(0, 0, 1);
    const q = rotationBetweenVectors(v, v.clone());
    // Identity quaternion: (0, 0, 0, 1)
    expect(q.x).toBeCloseTo(0);
    expect(q.y).toBeCloseTo(0);
    expect(q.z).toBeCloseTo(0);
    expect(q.w).toBeCloseTo(1);
  });

  it('produces a unit quaternion', () => {
    const from = new THREE.Vector3(1, 0, 0);
    const to = new THREE.Vector3(0, 1, 0);
    const q = rotationBetweenVectors(from, to);
    expect(q.length()).toBeCloseTo(1, 5);
  });

  it('correctly rotates the from vector to the to vector', () => {
    const from = new THREE.Vector3(1, 0, 0);
    const to = new THREE.Vector3(0, 1, 0);
    const q = rotationBetweenVectors(from, to);

    // Apply the quaternion to the from vector
    const result = from.clone().applyQuaternion(q);
    expect(result.x).toBeCloseTo(to.x, 4);
    expect(result.y).toBeCloseTo(to.y, 4);
    expect(result.z).toBeCloseTo(to.z, 4);
  });

  it('handles rotation from +Z to -Z (near-opposite vectors)', () => {
    const from = new THREE.Vector3(0, 0, 1);
    const to = new THREE.Vector3(0, 0, -1);
    const q = rotationBetweenVectors(from, to);
    // Should still be a valid unit quaternion
    expect(q.length()).toBeCloseTo(1, 5);
  });

  it('composes multiple rotations while preserving unit norm', () => {
    let q = new THREE.Quaternion(0, 0, 0, 1);
    const steps = [
      { from: new THREE.Vector3(0, 0, 1), to: new THREE.Vector3(0.5, 0.5, Math.sqrt(0.5)) },
      { from: new THREE.Vector3(0.5, 0.5, Math.sqrt(0.5)), to: new THREE.Vector3(1, 0, 0) },
      { from: new THREE.Vector3(1, 0, 0), to: new THREE.Vector3(0, -1, 0) },
    ];

    for (const { from, to } of steps) {
      const inc = rotationBetweenVectors(from.normalize(), to.normalize());
      q = new THREE.Quaternion().multiplyQuaternions(inc, q).normalize();
    }

    expect(q.length()).toBeCloseTo(1, 5);
  });
});

describe('computeAngularVelocity', () => {
  it('returns null when fewer than 2 samples', () => {
    expect(computeAngularVelocity([], 1.0)).toBeNull();
    expect(computeAngularVelocity([{ nx: 0, ny: 0, time: 0 }], 1.0)).toBeNull();
  });

  it('returns null when time span is too short (< 10ms)', () => {
    const samples = [
      { nx: 0, ny: 0, time: 100 },
      { nx: 0.5, ny: 0.5, time: 105 },
    ];
    expect(computeAngularVelocity(samples, 1.0)).toBeNull();
  });

  it('returns null when there is no movement', () => {
    const samples = [
      { nx: 0.3, ny: 0.3, time: 0 },
      { nx: 0.3, ny: 0.3, time: 100 },
    ];
    expect(computeAngularVelocity(samples, 1.0)).toBeNull();
  });

  it('computes a positive angular speed for a moving pointer', () => {
    const samples = [
      { nx: 0.0, ny: 0.0, time: 0 },
      { nx: 0.1, ny: 0.0, time: 20 },
      { nx: 0.2, ny: 0.0, time: 40 },
      { nx: 0.3, ny: 0.0, time: 60 },
    ];
    const result = computeAngularVelocity(samples, 1.0);
    expect(result).not.toBeNull();
    expect(result!.speed).toBeGreaterThan(0);
    expect(result!.axis.length()).toBeCloseTo(1, 5);
  });

  it('produces higher speed for faster pointer movement', () => {
    const slowSamples = [
      { nx: 0.0, ny: 0.0, time: 0 },
      { nx: 0.1, ny: 0.0, time: 100 },
    ];
    const fastSamples = [
      { nx: 0.0, ny: 0.0, time: 0 },
      { nx: 0.5, ny: 0.0, time: 100 },
    ];
    const slow = computeAngularVelocity(slowSamples, 1.0);
    const fast = computeAngularVelocity(fastSamples, 1.0);
    expect(slow).not.toBeNull();
    expect(fast).not.toBeNull();
    expect(fast!.speed).toBeGreaterThan(slow!.speed);
  });
});

describe('decaySpeed', () => {
  it('returns a smaller speed after decay', () => {
    const initial = 5.0;
    const decayed = decaySpeed(initial, 1 / 60); // one frame at 60fps
    expect(decayed).toBeLessThan(initial);
    expect(decayed).toBeGreaterThan(0);
  });

  it('decays monotonically over successive frames', () => {
    let speed = 10.0;
    const dt = 1 / 60;
    for (let i = 0; i < 100; i++) {
      const next = decaySpeed(speed, dt);
      expect(next).toBeLessThan(speed);
      expect(next).toBeGreaterThanOrEqual(0);
      speed = next;
    }
  });

  it('converges toward zero', () => {
    let speed = 10.0;
    const dt = 1 / 60;
    for (let i = 0; i < 600; i++) {
      speed = decaySpeed(speed, dt);
    }
    // After 10 seconds at 60fps, speed should be extremely small
    expect(speed).toBeLessThan(0.001);
  });

  it('returns zero when initial speed is zero', () => {
    expect(decaySpeed(0, 1.0)).toBe(0);
  });

  it('decays faster with larger delta time', () => {
    const initial = 5.0;
    const smallDt = decaySpeed(initial, 0.01);
    const largeDt = decaySpeed(initial, 0.1);
    expect(largeDt).toBeLessThan(smallDt);
  });
});
