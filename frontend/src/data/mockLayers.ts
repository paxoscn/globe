/**
 * Mock layer data for development — provides a "World Borders" layer
 * with simplified outlines of several continents/countries rendered
 * as GeoJSON LineStrings on the globe.
 */

import type { LayerMeta } from '../types';
import type { FeatureCollection } from '../types/geojson';

// ---------------------------------------------------------------------------
// Layer metadata
// ---------------------------------------------------------------------------

export const MOCK_LAYERS: LayerMeta[] = [
  {
    id: 'world-borders',
    name: 'World Borders',
    description: 'Simplified outlines of major landmasses',
    enabled: true,
    lodLevels: [0, 1, 2],
  },
  {
    id: 'cities',
    name: 'Major Cities',
    description: 'Locations of major world cities',
    enabled: false,
    lodLevels: [0, 1],
  },
];

// ---------------------------------------------------------------------------
// Simplified continent/country outlines (GeoJSON)
// Coordinates are [longitude, latitude] per GeoJSON spec.
// ---------------------------------------------------------------------------

export const MOCK_GEOJSON: Record<string, FeatureCollection> = {
  'world-borders': {
    type: 'FeatureCollection',
    features: [
      // --- North America (simplified) ---
      {
        type: 'Feature',
        properties: { name: 'North America' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [-130, 50], [-125, 55], [-120, 60], [-110, 65], [-100, 68],
            [-90, 65], [-80, 62], [-75, 58], [-70, 50], [-65, 45],
            [-70, 42], [-75, 38], [-80, 32], [-82, 28], [-85, 25],
            [-90, 28], [-95, 28], [-100, 30], [-105, 32], [-110, 32],
            [-115, 32], [-120, 35], [-125, 40], [-128, 45], [-130, 50],
          ],
        },
      },
      // --- South America (simplified) ---
      {
        type: 'Feature',
        properties: { name: 'South America' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [-80, 10], [-75, 10], [-70, 12], [-62, 10], [-55, 5],
            [-50, 0], [-48, -5], [-45, -10], [-40, -15], [-38, -20],
            [-40, -25], [-48, -28], [-52, -32], [-55, -35], [-58, -38],
            [-65, -42], [-68, -48], [-70, -52], [-72, -50], [-72, -45],
            [-70, -40], [-70, -35], [-70, -30], [-70, -25], [-70, -18],
            [-75, -12], [-78, -5], [-80, 0], [-78, 5], [-80, 10],
          ],
        },
      },
      // --- Europe (simplified) ---
      {
        type: 'Feature',
        properties: { name: 'Europe' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [-10, 36], [-8, 40], [-10, 42], [-5, 44], [0, 43],
            [3, 43], [5, 44], [8, 44], [12, 42], [15, 38],
            [18, 40], [22, 38], [25, 38], [28, 40], [30, 42],
            [32, 45], [35, 48], [30, 52], [25, 55], [20, 55],
            [18, 58], [15, 60], [10, 58], [8, 55], [5, 52],
            [2, 51], [0, 50], [-5, 48], [-8, 44], [-10, 36],
          ],
        },
      },
      // --- Africa (simplified) ---
      {
        type: 'Feature',
        properties: { name: 'Africa' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [-15, 30], [-17, 22], [-17, 15], [-15, 10], [-10, 5],
            [-5, 5], [0, 5], [5, 4], [10, 4], [10, 0],
            [12, -5], [15, -10], [20, -15], [25, -18], [30, -22],
            [32, -28], [28, -33], [22, -34], [18, -32], [15, -28],
            [12, -18], [10, -10], [10, -2], [15, 5], [20, 10],
            [25, 12], [30, 15], [32, 20], [35, 30], [32, 32],
            [28, 32], [20, 32], [10, 35], [5, 36], [0, 35],
            [-5, 35], [-10, 32], [-15, 30],
          ],
        },
      },
      // --- Asia (simplified) ---
      {
        type: 'Feature',
        properties: { name: 'Asia' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [35, 30], [40, 35], [45, 38], [50, 38], [55, 35],
            [60, 25], [65, 25], [70, 22], [75, 15], [78, 10],
            [80, 15], [85, 22], [90, 22], [95, 18], [100, 15],
            [105, 20], [110, 22], [115, 25], [120, 30], [125, 35],
            [130, 38], [135, 35], [140, 38], [142, 42], [145, 45],
            [140, 50], [135, 55], [130, 55], [120, 55], [110, 52],
            [100, 50], [90, 48], [80, 50], [70, 52], [60, 55],
            [50, 52], [45, 48], [40, 42], [35, 38], [35, 30],
          ],
        },
      },
      // --- Australia (simplified) ---
      {
        type: 'Feature',
        properties: { name: 'Australia' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [115, -20], [118, -18], [122, -15], [128, -14],
            [132, -12], [136, -12], [140, -15], [145, -15],
            [148, -18], [150, -22], [152, -25], [153, -28],
            [150, -32], [148, -35], [145, -38], [140, -38],
            [135, -35], [130, -32], [125, -32], [120, -30],
            [115, -32], [114, -28], [113, -25], [115, -20],
          ],
        },
      },
      // --- Japan (simplified) ---
      {
        type: 'Feature',
        properties: { name: 'Japan' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [130, 31], [131, 33], [132, 34], [134, 34],
            [136, 35], [138, 35], [140, 36], [141, 38],
            [140, 40], [141, 42], [142, 43], [145, 44],
            [144, 43], [143, 42], [141, 40], [140, 38],
            [139, 36], [137, 35], [135, 34], [133, 33],
            [131, 32], [130, 31],
          ],
        },
      },
      // --- UK/Ireland (simplified) ---
      {
        type: 'Feature',
        properties: { name: 'British Isles' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [-5, 50], [-3, 51], [0, 51], [1, 52], [1, 53],
            [0, 54], [-2, 55], [-3, 56], [-5, 58], [-3, 58],
            [-2, 57], [-1, 56], [0, 55], [-1, 54], [-3, 53],
            [-4, 52], [-5, 50],
          ],
        },
      },
    ],
  },
  cities: {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { name: 'New York', population: 8336817 }, geometry: { type: 'Point', coordinates: [-74.006, 40.7128] } },
      { type: 'Feature', properties: { name: 'London', population: 8982000 }, geometry: { type: 'Point', coordinates: [-0.1276, 51.5074] } },
      { type: 'Feature', properties: { name: 'Tokyo', population: 13960000 }, geometry: { type: 'Point', coordinates: [139.6917, 35.6895] } },
      { type: 'Feature', properties: { name: 'Sydney', population: 5312000 }, geometry: { type: 'Point', coordinates: [151.2093, -33.8688] } },
      { type: 'Feature', properties: { name: 'São Paulo', population: 12330000 }, geometry: { type: 'Point', coordinates: [-46.6333, -23.5505] } },
      { type: 'Feature', properties: { name: 'Cairo', population: 9540000 }, geometry: { type: 'Point', coordinates: [31.2357, 30.0444] } },
      { type: 'Feature', properties: { name: 'Mumbai', population: 12480000 }, geometry: { type: 'Point', coordinates: [72.8777, 19.076] } },
      { type: 'Feature', properties: { name: 'Beijing', population: 21540000 }, geometry: { type: 'Point', coordinates: [116.4074, 39.9042] } },
      { type: 'Feature', properties: { name: 'Moscow', population: 12680000 }, geometry: { type: 'Point', coordinates: [37.6173, 55.7558] } },
      { type: 'Feature', properties: { name: 'Buenos Aires', population: 3076000 }, geometry: { type: 'Point', coordinates: [-58.3816, -34.6037] } },
      { type: 'Feature', properties: { name: 'Shanghai', population: 24870000 }, geometry: { type: 'Point', coordinates: [121.4737, 31.2304] } },
      { type: 'Feature', properties: { name: 'Paris', population: 2161000 }, geometry: { type: 'Point', coordinates: [2.3522, 48.8566] } },
    ],
  },
};
