/**
 * GeoJSON parsing and rendering utilities for the globe surface.
 *
 * Converts GeoJSON FeatureCollections into Three.js BufferGeometry objects
 * positioned on a sphere surface. Supports LineString and Polygon geometry
 * types rendered as line segments on the globe.
 *
 * Requirements: 7.2 (smooth LOD transition), 10.4 (GeoJSON data format)
 */

import * as THREE from 'three';
import type {
  FeatureCollection,
  Geometry,
  GeoJSONPosition,
} from '../types/geojson';

// ---------------------------------------------------------------------------
// Coordinate conversion
// ---------------------------------------------------------------------------

/**
 * Convert geographic coordinates (latitude, longitude) to a 3D position
 * on a sphere of the given radius.
 *
 * Uses the standard geographic-to-Cartesian conversion:
 *   x = r · cos(lat) · cos(lng)
 *   y = r · sin(lat)
 *   z = r · cos(lat) · sin(lng)
 *
 * Note: Three.js uses Y-up convention, so latitude maps to the Y axis.
 *
 * @param lat  Latitude in degrees, range [-90, 90]
 * @param lng  Longitude in degrees, range [-180, 180]
 * @param radius  Sphere radius (default 1)
 * @returns THREE.Vector3 position on the sphere surface
 */
export function latLngToSpherePosition(
  lat: number,
  lng: number,
  radius: number = 1,
): THREE.Vector3 {
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;

  const x = radius * Math.cos(latRad) * Math.cos(lngRad);
  const y = radius * Math.sin(latRad);
  const z = radius * Math.cos(latRad) * Math.sin(lngRad);

  return new THREE.Vector3(x, y, z);
}

// ---------------------------------------------------------------------------
// GeoJSON parsing
// ---------------------------------------------------------------------------

/** Parsed geometry data extracted from a FeatureCollection. */
export interface ParsedFeature {
  /** Original feature properties. */
  properties: Record<string, unknown> | null;
  /** Geometry type from the GeoJSON feature. */
  geometryType: string;
  /**
   * Coordinate rings extracted from the geometry.
   * For LineString: one ring of positions.
   * For Polygon: multiple rings (outer + holes).
   * For Multi* types: flattened list of coordinate rings.
   */
  coordinateRings: GeoJSONPosition[][];
}

/**
 * Parse a GeoJSON FeatureCollection and extract geometry data suitable
 * for rendering.
 *
 * Supports: LineString, MultiLineString, Polygon, MultiPolygon.
 * Unsupported geometry types (Point, MultiPoint, GeometryCollection) are
 * silently skipped.
 *
 * @param geojson  A GeoJSON FeatureCollection
 * @returns Array of parsed features with their coordinate rings
 */
export function parseFeatureCollection(
  geojson: FeatureCollection,
): ParsedFeature[] {
  const results: ParsedFeature[] = [];

  for (const feature of geojson.features) {
    const parsed = parseGeometry(feature.geometry, feature.properties);
    if (parsed) {
      results.push(parsed);
    }
  }

  return results;
}

/**
 * Parse a single GeoJSON geometry into coordinate rings.
 */
function parseGeometry(
  geometry: Geometry,
  properties: Record<string, unknown> | null,
): ParsedFeature | null {
  switch (geometry.type) {
    case 'LineString':
      return {
        properties,
        geometryType: geometry.type,
        coordinateRings: [geometry.coordinates],
      };

    case 'MultiLineString':
      return {
        properties,
        geometryType: geometry.type,
        coordinateRings: geometry.coordinates,
      };

    case 'Polygon':
      return {
        properties,
        geometryType: geometry.type,
        coordinateRings: geometry.coordinates,
      };

    case 'MultiPolygon':
      return {
        properties,
        geometryType: geometry.type,
        // Flatten: each polygon has rings, we collect all rings
        coordinateRings: geometry.coordinates.flat(),
      };

    default:
      // Point, MultiPoint, GeometryCollection — skip
      return null;
  }
}

// ---------------------------------------------------------------------------
// Three.js geometry creation
// ---------------------------------------------------------------------------

/**
 * Create a Three.js BufferGeometry for a LineString rendered on a sphere.
 *
 * The geometry uses line segments connecting consecutive coordinate pairs
 * projected onto the sphere surface. A small offset (radius * 1.001) lifts
 * the lines slightly above the sphere to prevent z-fighting.
 *
 * @param coordinates  Array of GeoJSON positions [lng, lat] or [lng, lat, alt]
 * @param radius  Sphere radius
 * @returns BufferGeometry suitable for use with THREE.Line
 */
export function createLineGeometry(
  coordinates: GeoJSONPosition[],
  radius: number = 1,
): THREE.BufferGeometry {
  const offsetRadius = radius * 1.001; // slight offset to avoid z-fighting
  const positions: number[] = [];

  for (const coord of coordinates) {
    const lng = coord[0];
    const lat = coord[1];
    const pos = latLngToSpherePosition(lat, lng, offsetRadius);
    positions.push(pos.x, pos.y, pos.z);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );

  return geometry;
}

/**
 * Create a Three.js BufferGeometry for a Polygon outline rendered on a sphere.
 *
 * Renders each ring (outer boundary + holes) as a closed line loop projected
 * onto the sphere surface. The last point connects back to the first to close
 * the ring.
 *
 * @param coordinates  Array of coordinate rings (outer ring + optional holes)
 * @param radius  Sphere radius
 * @returns BufferGeometry suitable for use with THREE.LineLoop or THREE.Line
 */
export function createPolygonGeometry(
  coordinates: GeoJSONPosition[][],
  radius: number = 1,
): THREE.BufferGeometry {
  const offsetRadius = radius * 1.001;
  const positions: number[] = [];

  for (const ring of coordinates) {
    for (const coord of ring) {
      const lng = coord[0];
      const lat = coord[1];
      const pos = latLngToSpherePosition(lat, lng, offsetRadius);
      positions.push(pos.x, pos.y, pos.z);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );

  return geometry;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/** A rendered geometry with its associated feature properties. */
export interface GlobeGeometry {
  /** The Three.js geometry positioned on the sphere surface. */
  geometry: THREE.BufferGeometry;
  /** Original feature properties from the GeoJSON. */
  properties: Record<string, unknown> | null;
  /** The source geometry type. */
  geometryType: string;
}

/**
 * Create all Three.js geometries from a GeoJSON FeatureCollection.
 *
 * Parses the collection, converts each supported feature into a
 * BufferGeometry on the sphere surface, and returns them with their
 * associated properties.
 *
 * @param featureCollection  A GeoJSON FeatureCollection
 * @param radius  Sphere radius (default 1)
 * @returns Array of globe geometries ready for rendering
 */
export function createGlobeGeometries(
  featureCollection: FeatureCollection,
  radius: number = 1,
): GlobeGeometry[] {
  const parsed = parseFeatureCollection(featureCollection);
  const results: GlobeGeometry[] = [];

  for (const feature of parsed) {
    let geometry: THREE.BufferGeometry;

    if (
      feature.geometryType === 'LineString' ||
      feature.geometryType === 'MultiLineString'
    ) {
      // For MultiLineString, create geometry for each line and merge
      if (feature.coordinateRings.length === 1) {
        geometry = createLineGeometry(feature.coordinateRings[0], radius);
      } else {
        // Merge multiple line segments into one geometry
        const allPositions: number[] = [];
        for (const ring of feature.coordinateRings) {
          const lineGeom = createLineGeometry(ring, radius);
          const posAttr = lineGeom.getAttribute('position');
          for (let i = 0; i < posAttr.count * 3; i++) {
            allPositions.push(posAttr.array[i]);
          }
          lineGeom.dispose();
        }
        geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          'position',
          new THREE.Float32BufferAttribute(allPositions, 3),
        );
      }
    } else {
      // Polygon or MultiPolygon — render as outline
      geometry = createPolygonGeometry(feature.coordinateRings, radius);
    }

    results.push({
      geometry,
      properties: feature.properties,
      geometryType: feature.geometryType,
    });
  }

  return results;
}
