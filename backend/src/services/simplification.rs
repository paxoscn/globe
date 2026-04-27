/// Douglas-Peucker polyline simplification for multi-LOD vector tile generation.
///
/// Implements the Ramer-Douglas-Peucker algorithm as a pure function, plus
/// helpers to simplify GeoJSON geometries at the three LOD levels defined in
/// the design document.

/// LOD level definitions with their Douglas-Peucker tolerances (in degrees).
///
/// | LOD | Zoom Range | Tolerance | Use Case          |
/// |-----|-----------|-----------|-------------------|
/// | 0   | z=0–3     | 1.0°      | Global overview   |
/// | 1   | z=4–6     | 0.1°      | Continent/country |
/// | 2   | z=7+      | 0.01°     | Regional detail   |
pub const LOD_TOLERANCES: [(u8, f64); 3] = [
    (0, 1.0),   // LOD 0 – global overview
    (1, 0.1),   // LOD 1 – continent / country
    (2, 0.01),  // LOD 2 – regional detail
];

/// Perpendicular distance from point `p` to the line segment defined by
/// `start` and `end`.  All coordinates are `[x, y]` (longitude, latitude).
///
/// When `start == end` the distance degenerates to the Euclidean distance
/// between `p` and `start`.
fn perpendicular_distance(p: &[f64; 2], start: &[f64; 2], end: &[f64; 2]) -> f64 {
    let dx = end[0] - start[0];
    let dy = end[1] - start[1];

    let line_len_sq = dx * dx + dy * dy;

    if line_len_sq < f64::EPSILON {
        // start and end are the same point – just return Euclidean distance
        let ex = p[0] - start[0];
        let ey = p[1] - start[1];
        return (ex * ex + ey * ey).sqrt();
    }

    // |cross product| / |line length|
    let numerator = ((end[0] - start[0]) * (start[1] - p[1])
        - (start[0] - p[0]) * (end[1] - start[1]))
        .abs();
    let denominator = line_len_sq.sqrt();

    numerator / denominator
}

/// Ramer-Douglas-Peucker simplification.
///
/// Given a polyline (slice of `[f64; 2]` points) and a positive `tolerance`,
/// returns a simplified polyline that is a subset of the original points.
///
/// # Guarantees
/// - The first and last points are always preserved.
/// - Every point in the output exists in the input (subset property).
/// - The output has ≤ the number of points in the input.
/// - The maximum perpendicular distance from any omitted point to the
///   simplified line is within `tolerance`.
///
/// # Panics
/// Panics if `tolerance` is not positive (i.e. `tolerance <= 0.0`).
pub fn douglas_peucker(points: &[[f64; 2]], tolerance: f64) -> Vec<[f64; 2]> {
    assert!(tolerance > 0.0, "tolerance must be positive");

    if points.len() <= 2 {
        return points.to_vec();
    }

    // Find the point with the maximum distance from the line (first → last)
    let first = &points[0];
    let last = &points[points.len() - 1];

    let mut max_dist = 0.0_f64;
    let mut max_idx = 0_usize;

    for (i, pt) in points.iter().enumerate().skip(1).take(points.len() - 2) {
        let dist = perpendicular_distance(pt, first, last);
        if dist > max_dist {
            max_dist = dist;
            max_idx = i;
        }
    }

    if max_dist > tolerance {
        // Recursively simplify both halves
        let mut left = douglas_peucker(&points[..=max_idx], tolerance);
        let right = douglas_peucker(&points[max_idx..], tolerance);

        // Remove the duplicate junction point
        left.pop();
        left.extend_from_slice(&right);
        left
    } else {
        // All intermediate points are within tolerance – keep only endpoints
        vec![*first, *last]
    }
}

/// Simplify a GeoJSON `Value` at a specific LOD level.
///
/// Walks the GeoJSON structure and applies Douglas-Peucker simplification to
/// every `LineString` and `Polygon` ring using the tolerance for the given
/// `lod_level`.
///
/// Returns a new `serde_json::Value` with simplified coordinates.
/// Unsupported geometry types (e.g. `Point`, `MultiPoint`) are returned
/// unchanged.
pub fn simplify_geojson(geojson: &serde_json::Value, lod_level: u8) -> serde_json::Value {
    let tolerance = LOD_TOLERANCES
        .iter()
        .find(|(level, _)| *level == lod_level)
        .map(|(_, tol)| *tol)
        .unwrap_or(0.01); // default to highest detail

    let mut result = geojson.clone();
    simplify_geojson_value(&mut result, tolerance);
    result
}

/// Recursively walk a GeoJSON value and simplify coordinate arrays in place.
fn simplify_geojson_value(value: &mut serde_json::Value, tolerance: f64) {
    match value {
        serde_json::Value::Object(map) => {
            let geom_type = map
                .get("type")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            match geom_type.as_str() {
                "FeatureCollection" => {
                    if let Some(features) = map.get_mut("features") {
                        if let Some(arr) = features.as_array_mut() {
                            for feature in arr.iter_mut() {
                                simplify_geojson_value(feature, tolerance);
                            }
                        }
                    }
                }
                "Feature" => {
                    if let Some(geometry) = map.get_mut("geometry") {
                        simplify_geojson_value(geometry, tolerance);
                    }
                }
                "LineString" => {
                    if let Some(coords) = map.get_mut("coordinates") {
                        simplify_coordinate_array(coords, tolerance);
                    }
                }
                "MultiLineString" => {
                    if let Some(coords) = map.get_mut("coordinates") {
                        if let Some(lines) = coords.as_array_mut() {
                            for line in lines.iter_mut() {
                                simplify_coordinate_array(line, tolerance);
                            }
                        }
                    }
                }
                "Polygon" => {
                    if let Some(coords) = map.get_mut("coordinates") {
                        if let Some(rings) = coords.as_array_mut() {
                            for ring in rings.iter_mut() {
                                simplify_coordinate_array(ring, tolerance);
                            }
                        }
                    }
                }
                "MultiPolygon" => {
                    if let Some(coords) = map.get_mut("coordinates") {
                        if let Some(polygons) = coords.as_array_mut() {
                            for polygon in polygons.iter_mut() {
                                if let Some(rings) = polygon.as_array_mut() {
                                    for ring in rings.iter_mut() {
                                        simplify_coordinate_array(ring, tolerance);
                                    }
                                }
                            }
                        }
                    }
                }
                "GeometryCollection" => {
                    if let Some(geometries) = map.get_mut("geometries") {
                        if let Some(arr) = geometries.as_array_mut() {
                            for geom in arr.iter_mut() {
                                simplify_geojson_value(geom, tolerance);
                            }
                        }
                    }
                }
                // Point, MultiPoint – nothing to simplify
                _ => {}
            }
        }
        _ => {}
    }
}

/// Parse a JSON coordinate array into `Vec<[f64; 2]>`, simplify, and write back.
fn simplify_coordinate_array(coords: &mut serde_json::Value, tolerance: f64) {
    if let Some(arr) = coords.as_array() {
        let points: Vec<[f64; 2]> = arr
            .iter()
            .filter_map(|c| {
                let pair = c.as_array()?;
                if pair.len() >= 2 {
                    Some([pair[0].as_f64()?, pair[1].as_f64()?])
                } else {
                    None
                }
            })
            .collect();

        if points.len() > 2 {
            let simplified = douglas_peucker(&points, tolerance);
            let json_coords: Vec<serde_json::Value> = simplified
                .iter()
                .map(|p| serde_json::json!([p[0], p[1]]))
                .collect();
            *coords = serde_json::Value::Array(json_coords);
        }
    }
}

/// Generate simplified GeoJSON for all LOD levels.
///
/// Returns a `Vec<(lod_level, simplified_geojson)>` with one entry per LOD.
pub fn generate_all_lod_levels(
    geojson: &serde_json::Value,
) -> Vec<(u8, serde_json::Value)> {
    LOD_TOLERANCES
        .iter()
        .map(|(level, _)| (*level, simplify_geojson(geojson, *level)))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── Core algorithm tests ──────────────────────────────────────────

    #[test]
    fn test_empty_polyline() {
        let pts: Vec<[f64; 2]> = vec![];
        let result = douglas_peucker(&pts, 1.0);
        assert!(result.is_empty());
    }

    #[test]
    fn test_single_point() {
        let pts = vec![[1.0, 2.0]];
        let result = douglas_peucker(&pts, 1.0);
        assert_eq!(result, vec![[1.0, 2.0]]);
    }

    #[test]
    fn test_two_points_preserved() {
        let pts = vec![[0.0, 0.0], [10.0, 10.0]];
        let result = douglas_peucker(&pts, 0.5);
        assert_eq!(result, pts);
    }

    #[test]
    fn test_collinear_points_simplified() {
        // Three collinear points – middle point has zero distance
        let pts = vec![[0.0, 0.0], [5.0, 5.0], [10.0, 10.0]];
        let result = douglas_peucker(&pts, 0.1);
        assert_eq!(result, vec![[0.0, 0.0], [10.0, 10.0]]);
    }

    #[test]
    fn test_significant_deviation_preserved() {
        // Middle point deviates significantly from the line
        let pts = vec![[0.0, 0.0], [5.0, 10.0], [10.0, 0.0]];
        // The perpendicular distance of (5,10) from line (0,0)→(10,0) is 10.0
        let result = douglas_peucker(&pts, 5.0);
        assert_eq!(result, vec![[0.0, 0.0], [5.0, 10.0], [10.0, 0.0]]);
    }

    #[test]
    fn test_first_and_last_always_preserved() {
        let pts = vec![
            [0.0, 0.0],
            [1.0, 0.001],
            [2.0, 0.0],
            [3.0, 0.001],
            [4.0, 0.0],
        ];
        let result = douglas_peucker(&pts, 1.0);
        assert_eq!(result[0], [0.0, 0.0]);
        assert_eq!(result[result.len() - 1], [4.0, 0.0]);
    }

    #[test]
    fn test_output_is_subset_of_input() {
        let pts = vec![
            [0.0, 0.0],
            [1.0, 2.0],
            [3.0, 1.0],
            [5.0, 4.0],
            [7.0, 0.0],
        ];
        let result = douglas_peucker(&pts, 0.5);
        for pt in &result {
            assert!(pts.contains(pt), "Output point {:?} not in input", pt);
        }
    }

    #[test]
    fn test_output_no_larger_than_input() {
        let pts = vec![
            [0.0, 0.0],
            [1.0, 2.0],
            [3.0, 1.0],
            [5.0, 4.0],
            [7.0, 0.0],
        ];
        let result = douglas_peucker(&pts, 0.5);
        assert!(result.len() <= pts.len());
    }

    #[test]
    fn test_large_tolerance_keeps_only_endpoints() {
        let pts = vec![
            [0.0, 0.0],
            [1.0, 0.5],
            [2.0, 0.3],
            [3.0, 0.1],
            [4.0, 0.0],
        ];
        let result = douglas_peucker(&pts, 100.0);
        assert_eq!(result, vec![[0.0, 0.0], [4.0, 0.0]]);
    }

    #[test]
    fn test_small_tolerance_keeps_all_points() {
        let pts = vec![
            [0.0, 0.0],
            [1.0, 5.0],
            [2.0, -3.0],
            [3.0, 7.0],
            [4.0, 0.0],
        ];
        // With a very small tolerance, all significant points should be kept
        let result = douglas_peucker(&pts, 0.0001);
        assert_eq!(result.len(), pts.len());
    }

    #[test]
    #[should_panic(expected = "tolerance must be positive")]
    fn test_zero_tolerance_panics() {
        let pts = vec![[0.0, 0.0], [1.0, 1.0], [2.0, 0.0]];
        douglas_peucker(&pts, 0.0);
    }

    #[test]
    #[should_panic(expected = "tolerance must be positive")]
    fn test_negative_tolerance_panics() {
        let pts = vec![[0.0, 0.0], [1.0, 1.0], [2.0, 0.0]];
        douglas_peucker(&pts, -1.0);
    }

    // ── Perpendicular distance tests ──────────────────────────────────

    #[test]
    fn test_perpendicular_distance_on_line() {
        // Point on the line has zero distance
        let dist = perpendicular_distance(&[5.0, 5.0], &[0.0, 0.0], &[10.0, 10.0]);
        assert!(dist.abs() < 1e-10);
    }

    #[test]
    fn test_perpendicular_distance_off_line() {
        // Point (5, 10) to horizontal line (0,0)→(10,0) should be 10.0
        let dist = perpendicular_distance(&[5.0, 10.0], &[0.0, 0.0], &[10.0, 0.0]);
        assert!((dist - 10.0).abs() < 1e-10);
    }

    #[test]
    fn test_perpendicular_distance_degenerate_line() {
        // start == end: distance is Euclidean to the point
        let dist = perpendicular_distance(&[3.0, 4.0], &[0.0, 0.0], &[0.0, 0.0]);
        assert!((dist - 5.0).abs() < 1e-10);
    }

    // ── GeoJSON simplification tests ──────────────────────────────────

    #[test]
    fn test_simplify_geojson_linestring() {
        let geojson = serde_json::json!({
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [0.0, 0.0],
                    [5.0, 0.001],
                    [10.0, 0.0]
                ]
            },
            "properties": {}
        });

        // LOD 0 (tolerance 1.0°) should simplify away the near-collinear middle point
        let simplified = simplify_geojson(&geojson, 0);
        let coords = simplified["geometry"]["coordinates"].as_array().unwrap();
        assert_eq!(coords.len(), 2);
        assert_eq!(coords[0], serde_json::json!([0.0, 0.0]));
        assert_eq!(coords[1], serde_json::json!([10.0, 0.0]));
    }

    #[test]
    fn test_simplify_geojson_feature_collection() {
        let geojson = serde_json::json!({
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [
                            [0.0, 0.0],
                            [1.0, 0.0001],
                            [2.0, 0.0],
                            [3.0, 5.0],
                            [4.0, 0.0]
                        ]
                    },
                    "properties": {"name": "test"}
                }
            ]
        });

        let simplified = simplify_geojson(&geojson, 0);
        let features = simplified["features"].as_array().unwrap();
        assert_eq!(features.len(), 1);

        let coords = features[0]["geometry"]["coordinates"].as_array().unwrap();
        // With tolerance 1.0, the point at (3, 5) should be preserved
        assert!(coords.len() < 5);
        // First and last preserved
        assert_eq!(coords[0], serde_json::json!([0.0, 0.0]));
        assert_eq!(coords[coords.len() - 1], serde_json::json!([4.0, 0.0]));
    }

    #[test]
    fn test_simplify_geojson_polygon() {
        let geojson = serde_json::json!({
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [0.0, 0.0],
                    [10.0, 0.001],
                    [10.0, 10.0],
                    [0.001, 10.0],
                    [0.0, 0.0]
                ]]
            },
            "properties": {}
        });

        let simplified = simplify_geojson(&geojson, 0);
        let rings = simplified["geometry"]["coordinates"].as_array().unwrap();
        assert_eq!(rings.len(), 1);
        let ring = rings[0].as_array().unwrap();
        // With tolerance 1.0, near-collinear points on edges may be removed
        assert!(ring.len() <= 5);
        // First and last preserved
        assert_eq!(ring[0], serde_json::json!([0.0, 0.0]));
        assert_eq!(ring[ring.len() - 1], serde_json::json!([0.0, 0.0]));
    }

    #[test]
    fn test_simplify_geojson_point_unchanged() {
        let geojson = serde_json::json!({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [2.3522, 48.8566]
            },
            "properties": {}
        });

        let simplified = simplify_geojson(&geojson, 0);
        assert_eq!(simplified, geojson);
    }

    #[test]
    fn test_simplify_geojson_preserves_properties() {
        let geojson = serde_json::json!({
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [0.0, 0.0],
                    [5.0, 0.001],
                    [10.0, 0.0]
                ]
            },
            "properties": {"name": "coastline", "year": 1800}
        });

        let simplified = simplify_geojson(&geojson, 0);
        assert_eq!(simplified["properties"]["name"], "coastline");
        assert_eq!(simplified["properties"]["year"], 1800);
    }

    // ── LOD generation tests ──────────────────────────────────────────

    #[test]
    fn test_generate_all_lod_levels() {
        let geojson = serde_json::json!({
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [0.0, 0.0],
                    [1.0, 0.5],
                    [2.0, 0.001],
                    [3.0, 0.0]
                ]
            },
            "properties": {}
        });

        let lods = generate_all_lod_levels(&geojson);
        assert_eq!(lods.len(), 3);
        assert_eq!(lods[0].0, 0); // LOD 0
        assert_eq!(lods[1].0, 1); // LOD 1
        assert_eq!(lods[2].0, 2); // LOD 2

        // Higher LOD should have >= points compared to lower LOD
        let lod0_coords = lods[0].1["geometry"]["coordinates"]
            .as_array()
            .unwrap()
            .len();
        let lod1_coords = lods[1].1["geometry"]["coordinates"]
            .as_array()
            .unwrap()
            .len();
        let lod2_coords = lods[2].1["geometry"]["coordinates"]
            .as_array()
            .unwrap()
            .len();

        assert!(lod0_coords <= lod1_coords);
        assert!(lod1_coords <= lod2_coords);
    }

    #[test]
    fn test_lod_tolerances_are_ordered() {
        // Verify LOD levels are in ascending order and tolerances in descending order
        for i in 1..LOD_TOLERANCES.len() {
            assert!(LOD_TOLERANCES[i].0 > LOD_TOLERANCES[i - 1].0);
            assert!(LOD_TOLERANCES[i].1 < LOD_TOLERANCES[i - 1].1);
        }
    }
}
