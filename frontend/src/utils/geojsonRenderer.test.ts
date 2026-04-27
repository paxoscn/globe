import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  latLngToSpherePosition,
  parseFeatureCollection,
  createLineGeometry,
  createPolygonGeometry,
  createGlobeGeometries,
} from './geojsonRenderer';
import type { FeatureCollection, GeoJSONPosition } from '../types/geojson';

// ---------------------------------------------------------------------------
// latLngToSpherePosition
// ---------------------------------------------------------------------------

describe('latLngToSpherePosition', () => {
  it('places (0, 0) on the positive X axis for unit sphere', () => {
    const pos = latLngToSpherePosition(0, 0, 1);
    expect(pos.x).toBeCloseTo(1, 5);
    expect(pos.y).toBeCloseTo(0, 5);
    expect(pos.z).toBeCloseTo(0, 5);
  });

  it('places (0, 90) on the positive Z axis', () => {
    const pos = latLngToSpherePosition(0, 90, 1);
    expect(pos.x).toBeCloseTo(0, 5);
    expect(pos.y).toBeCloseTo(0, 5);
    expect(pos.z).toBeCloseTo(1, 5);
  });

  it('places (0, -90) on the negative Z axis', () => {
    const pos = latLngToSpherePosition(0, -90, 1);
    expect(pos.x).toBeCloseTo(0, 5);
    expect(pos.y).toBeCloseTo(0, 5);
    expect(pos.z).toBeCloseTo(-1, 5);
  });

  it('places (90, 0) at the north pole (positive Y)', () => {
    const pos = latLngToSpherePosition(90, 0, 1);
    expect(pos.x).toBeCloseTo(0, 5);
    expect(pos.y).toBeCloseTo(1, 5);
    expect(pos.z).toBeCloseTo(0, 5);
  });

  it('places (-90, 0) at the south pole (negative Y)', () => {
    const pos = latLngToSpherePosition(-90, 0, 1);
    expect(pos.x).toBeCloseTo(0, 5);
    expect(pos.y).toBeCloseTo(-1, 5);
    expect(pos.z).toBeCloseTo(0, 5);
  });

  it('scales position by radius', () => {
    const radius = 5;
    const pos = latLngToSpherePosition(0, 0, radius);
    expect(pos.x).toBeCloseTo(radius, 5);
    expect(pos.y).toBeCloseTo(0, 5);
    expect(pos.z).toBeCloseTo(0, 5);
  });

  it('produces a point at the correct distance from origin', () => {
    const radius = 3;
    const pos = latLngToSpherePosition(45, 60, radius);
    expect(pos.length()).toBeCloseTo(radius, 5);
  });

  it('defaults to radius 1 when not specified', () => {
    const pos = latLngToSpherePosition(0, 0);
    expect(pos.length()).toBeCloseTo(1, 5);
  });

  it('places (0, 180) on the negative X axis', () => {
    const pos = latLngToSpherePosition(0, 180, 1);
    expect(pos.x).toBeCloseTo(-1, 5);
    expect(pos.y).toBeCloseTo(0, 5);
    expect(pos.z).toBeCloseTo(0, 4); // sin(180°) ≈ 0
  });
});

// ---------------------------------------------------------------------------
// parseFeatureCollection
// ---------------------------------------------------------------------------

describe('parseFeatureCollection', () => {
  it('parses a LineString feature', () => {
    const geojson: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, 0],
              [10, 10],
              [20, 20],
            ],
          },
          properties: { name: 'test-line' },
        },
      ],
    };

    const parsed = parseFeatureCollection(geojson);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].geometryType).toBe('LineString');
    expect(parsed[0].coordinateRings).toHaveLength(1);
    expect(parsed[0].coordinateRings[0]).toHaveLength(3);
    expect(parsed[0].properties).toEqual({ name: 'test-line' });
  });

  it('parses a Polygon feature with outer ring', () => {
    const geojson: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [10, 0],
                [10, 10],
                [0, 10],
                [0, 0],
              ],
            ],
          },
          properties: null,
        },
      ],
    };

    const parsed = parseFeatureCollection(geojson);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].geometryType).toBe('Polygon');
    expect(parsed[0].coordinateRings).toHaveLength(1);
    expect(parsed[0].coordinateRings[0]).toHaveLength(5);
  });

  it('parses a MultiLineString feature', () => {
    const geojson: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'MultiLineString',
            coordinates: [
              [
                [0, 0],
                [10, 10],
              ],
              [
                [20, 20],
                [30, 30],
              ],
            ],
          },
          properties: null,
        },
      ],
    };

    const parsed = parseFeatureCollection(geojson);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].geometryType).toBe('MultiLineString');
    expect(parsed[0].coordinateRings).toHaveLength(2);
  });

  it('parses a MultiPolygon feature', () => {
    const geojson: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'MultiPolygon',
            coordinates: [
              [
                [
                  [0, 0],
                  [10, 0],
                  [10, 10],
                  [0, 0],
                ],
              ],
              [
                [
                  [20, 20],
                  [30, 20],
                  [30, 30],
                  [20, 20],
                ],
              ],
            ],
          },
          properties: null,
        },
      ],
    };

    const parsed = parseFeatureCollection(geojson);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].geometryType).toBe('MultiPolygon');
    // Two polygons, each with one ring → 2 rings total
    expect(parsed[0].coordinateRings).toHaveLength(2);
  });

  it('skips Point geometry features', () => {
    const geojson: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [0, 0] },
          properties: null,
        },
      ],
    };

    const parsed = parseFeatureCollection(geojson);
    expect(parsed).toHaveLength(0);
  });

  it('handles empty FeatureCollection', () => {
    const geojson: FeatureCollection = {
      type: 'FeatureCollection',
      features: [],
    };

    const parsed = parseFeatureCollection(geojson);
    expect(parsed).toHaveLength(0);
  });

  it('parses multiple features of different types', () => {
    const geojson: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, 0],
              [10, 10],
            ],
          },
          properties: { id: 1 },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [5, 5] },
          properties: { id: 2 },
        },
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 0],
              ],
            ],
          },
          properties: { id: 3 },
        },
      ],
    };

    const parsed = parseFeatureCollection(geojson);
    // Point is skipped
    expect(parsed).toHaveLength(2);
    expect(parsed[0].geometryType).toBe('LineString');
    expect(parsed[1].geometryType).toBe('Polygon');
  });
});

// ---------------------------------------------------------------------------
// createLineGeometry
// ---------------------------------------------------------------------------

describe('createLineGeometry', () => {
  it('creates geometry with correct number of vertices', () => {
    const coords: GeoJSONPosition[] = [
      [0, 0],
      [10, 10],
      [20, 20],
    ];
    const geom = createLineGeometry(coords, 1);
    const posAttr = geom.getAttribute('position');
    expect(posAttr.count).toBe(3);
    geom.dispose();
  });

  it('places vertices on the sphere surface (with offset)', () => {
    const coords: GeoJSONPosition[] = [
      [0, 0],
      [90, 0],
    ];
    const radius = 1;
    const geom = createLineGeometry(coords, radius);
    const posAttr = geom.getAttribute('position');

    for (let i = 0; i < posAttr.count; i++) {
      const v = new THREE.Vector3(
        posAttr.getX(i),
        posAttr.getY(i),
        posAttr.getZ(i),
      );
      // Should be at radius * 1.001 (the z-fighting offset)
      expect(v.length()).toBeCloseTo(radius * 1.001, 3);
    }
    geom.dispose();
  });

  it('handles a single coordinate', () => {
    const coords: GeoJSONPosition[] = [[0, 0]];
    const geom = createLineGeometry(coords, 1);
    const posAttr = geom.getAttribute('position');
    expect(posAttr.count).toBe(1);
    geom.dispose();
  });

  it('handles empty coordinates', () => {
    const coords: GeoJSONPosition[] = [];
    const geom = createLineGeometry(coords, 1);
    const posAttr = geom.getAttribute('position');
    expect(posAttr.count).toBe(0);
    geom.dispose();
  });

  it('respects custom radius', () => {
    const coords: GeoJSONPosition[] = [[0, 0]];
    const radius = 5;
    const geom = createLineGeometry(coords, radius);
    const posAttr = geom.getAttribute('position');
    const v = new THREE.Vector3(
      posAttr.getX(0),
      posAttr.getY(0),
      posAttr.getZ(0),
    );
    expect(v.length()).toBeCloseTo(radius * 1.001, 3);
    geom.dispose();
  });
});

// ---------------------------------------------------------------------------
// createPolygonGeometry
// ---------------------------------------------------------------------------

describe('createPolygonGeometry', () => {
  it('creates geometry for a simple polygon ring', () => {
    const coords: GeoJSONPosition[][] = [
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
    ];
    const geom = createPolygonGeometry(coords, 1);
    const posAttr = geom.getAttribute('position');
    expect(posAttr.count).toBe(5);
    geom.dispose();
  });

  it('creates geometry for polygon with hole', () => {
    const outer: GeoJSONPosition[] = [
      [0, 0],
      [20, 0],
      [20, 20],
      [0, 20],
      [0, 0],
    ];
    const hole: GeoJSONPosition[] = [
      [5, 5],
      [15, 5],
      [15, 15],
      [5, 15],
      [5, 5],
    ];
    const geom = createPolygonGeometry([outer, hole], 1);
    const posAttr = geom.getAttribute('position');
    // 5 outer + 5 hole = 10 vertices
    expect(posAttr.count).toBe(10);
    geom.dispose();
  });

  it('places vertices on the sphere surface (with offset)', () => {
    const coords: GeoJSONPosition[][] = [
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 0],
      ],
    ];
    const radius = 2;
    const geom = createPolygonGeometry(coords, radius);
    const posAttr = geom.getAttribute('position');

    for (let i = 0; i < posAttr.count; i++) {
      const v = new THREE.Vector3(
        posAttr.getX(i),
        posAttr.getY(i),
        posAttr.getZ(i),
      );
      expect(v.length()).toBeCloseTo(radius * 1.001, 3);
    }
    geom.dispose();
  });

  it('handles empty rings', () => {
    const geom = createPolygonGeometry([], 1);
    const posAttr = geom.getAttribute('position');
    expect(posAttr.count).toBe(0);
    geom.dispose();
  });
});

// ---------------------------------------------------------------------------
// createGlobeGeometries
// ---------------------------------------------------------------------------

describe('createGlobeGeometries', () => {
  it('creates geometries for a LineString feature', () => {
    const geojson: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, 0],
              [10, 10],
              [20, 20],
            ],
          },
          properties: { name: 'coastline' },
        },
      ],
    };

    const results = createGlobeGeometries(geojson, 1);
    expect(results).toHaveLength(1);
    expect(results[0].geometryType).toBe('LineString');
    expect(results[0].properties).toEqual({ name: 'coastline' });

    const posAttr = results[0].geometry.getAttribute('position');
    expect(posAttr.count).toBe(3);

    results.forEach((r) => r.geometry.dispose());
  });

  it('creates geometries for a Polygon feature', () => {
    const geojson: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [10, 0],
                [10, 10],
                [0, 10],
                [0, 0],
              ],
            ],
          },
          properties: null,
        },
      ],
    };

    const results = createGlobeGeometries(geojson, 1);
    expect(results).toHaveLength(1);
    expect(results[0].geometryType).toBe('Polygon');

    const posAttr = results[0].geometry.getAttribute('position');
    expect(posAttr.count).toBe(5);

    results.forEach((r) => r.geometry.dispose());
  });

  it('creates geometries for MultiLineString', () => {
    const geojson: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'MultiLineString',
            coordinates: [
              [
                [0, 0],
                [10, 10],
              ],
              [
                [20, 20],
                [30, 30],
              ],
            ],
          },
          properties: null,
        },
      ],
    };

    const results = createGlobeGeometries(geojson, 1);
    expect(results).toHaveLength(1);
    expect(results[0].geometryType).toBe('MultiLineString');

    // 2 + 2 = 4 vertices merged
    const posAttr = results[0].geometry.getAttribute('position');
    expect(posAttr.count).toBe(4);

    results.forEach((r) => r.geometry.dispose());
  });

  it('skips unsupported geometry types', () => {
    const geojson: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [0, 0] },
          properties: null,
        },
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, 0],
              [10, 10],
            ],
          },
          properties: null,
        },
      ],
    };

    const results = createGlobeGeometries(geojson, 1);
    expect(results).toHaveLength(1);
    expect(results[0].geometryType).toBe('LineString');

    results.forEach((r) => r.geometry.dispose());
  });

  it('returns empty array for empty FeatureCollection', () => {
    const geojson: FeatureCollection = {
      type: 'FeatureCollection',
      features: [],
    };

    const results = createGlobeGeometries(geojson, 1);
    expect(results).toHaveLength(0);
  });

  it('uses custom radius for geometry placement', () => {
    const geojson: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, 0],
              [90, 0],
            ],
          },
          properties: null,
        },
      ],
    };

    const radius = 3;
    const results = createGlobeGeometries(geojson, radius);
    const posAttr = results[0].geometry.getAttribute('position');

    for (let i = 0; i < posAttr.count; i++) {
      const v = new THREE.Vector3(
        posAttr.getX(i),
        posAttr.getY(i),
        posAttr.getZ(i),
      );
      expect(v.length()).toBeCloseTo(radius * 1.001, 3);
    }

    results.forEach((r) => r.geometry.dispose());
  });

  it('handles mixed feature types in one collection', () => {
    const geojson: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, 0],
              [10, 10],
            ],
          },
          properties: { type: 'line' },
        },
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [5, 0],
                [5, 5],
                [0, 0],
              ],
            ],
          },
          properties: { type: 'polygon' },
        },
      ],
    };

    const results = createGlobeGeometries(geojson, 1);
    expect(results).toHaveLength(2);
    expect(results[0].geometryType).toBe('LineString');
    expect(results[1].geometryType).toBe('Polygon');

    results.forEach((r) => r.geometry.dispose());
  });
});
