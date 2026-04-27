/**
 * GeoJSON type definitions following RFC 7946.
 * Used for vector tile data transfer between backend and frontend.
 */

export type GeoJSONPosition = [number, number] | [number, number, number];

export interface Point {
  type: 'Point';
  coordinates: GeoJSONPosition;
}

export interface MultiPoint {
  type: 'MultiPoint';
  coordinates: GeoJSONPosition[];
}

export interface LineString {
  type: 'LineString';
  coordinates: GeoJSONPosition[];
}

export interface MultiLineString {
  type: 'MultiLineString';
  coordinates: GeoJSONPosition[][];
}

export interface Polygon {
  type: 'Polygon';
  coordinates: GeoJSONPosition[][];
}

export interface MultiPolygon {
  type: 'MultiPolygon';
  coordinates: GeoJSONPosition[][][];
}

export interface GeometryCollection {
  type: 'GeometryCollection';
  geometries: Geometry[];
}

export type Geometry =
  | Point
  | MultiPoint
  | LineString
  | MultiLineString
  | Polygon
  | MultiPolygon
  | GeometryCollection;

export interface Feature {
  type: 'Feature';
  geometry: Geometry;
  properties: Record<string, unknown> | null;
  id?: string | number;
}

export interface FeatureCollection {
  type: 'FeatureCollection';
  features: Feature[];
}

export type GeoJSON = Geometry | Feature | FeatureCollection;
