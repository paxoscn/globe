use axum::http::StatusCode;
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder};
use serde::Serialize;
use std::time::Duration;

use crate::entities::{object_references, tiles};

/// Error types returned by the tile service.
#[derive(Debug)]
pub enum TileServiceError {
    /// Tile not found for the given coordinates.
    NotFound {
        layer_id: String,
        z: i16,
        x: i32,
        y: i32,
    },
    /// Invalid tile coordinates.
    InvalidCoordinates { message: String },
    /// Database query timed out.
    QueryTimeout,
    /// Internal database error.
    DatabaseError(String),
}

impl TileServiceError {
    pub fn status_code(&self) -> StatusCode {
        match self {
            TileServiceError::NotFound { .. } => StatusCode::NOT_FOUND,
            TileServiceError::InvalidCoordinates { .. } => StatusCode::BAD_REQUEST,
            TileServiceError::QueryTimeout => StatusCode::GATEWAY_TIMEOUT,
            TileServiceError::DatabaseError(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    pub fn error_code(&self) -> &str {
        match self {
            TileServiceError::NotFound { .. } => "TILE_NOT_FOUND",
            TileServiceError::InvalidCoordinates { .. } => "INVALID_COORDINATES",
            TileServiceError::QueryTimeout => "QUERY_TIMEOUT",
            TileServiceError::DatabaseError(_) => "INTERNAL_ERROR",
        }
    }

    pub fn message(&self) -> String {
        match self {
            TileServiceError::NotFound {
                layer_id,
                z,
                x,
                y,
            } => {
                format!(
                    "Tile not found for layer '{}' at z={}, x={}, y={}",
                    layer_id, z, x, y
                )
            }
            TileServiceError::InvalidCoordinates { message } => message.clone(),
            TileServiceError::QueryTimeout => {
                "Database query timed out after 5 seconds".to_string()
            }
            TileServiceError::DatabaseError(msg) => {
                format!("Internal database error: {}", msg)
            }
        }
    }

    pub fn retry_after(&self) -> Option<u64> {
        match self {
            TileServiceError::QueryTimeout => Some(5),
            _ => None,
        }
    }
}

/// Serializable object reference embedded in GeoJSON feature properties.
#[derive(Debug, Serialize)]
pub struct EmbeddedObjectRef {
    pub object_id: String,
    pub latitude: f64,
    pub longitude: f64,
    pub properties: serde_json::Value,
}

/// Query timeout for database operations (5 seconds as per design doc).
const QUERY_TIMEOUT: Duration = Duration::from_secs(5);

/// Validate tile coordinates. Returns (z as i16, x, y) or an error.
///
/// When used with `?time=` parameter, z can be any non-negative value
/// (representing Ma or other time index). The z <= 20 limit only applies
/// to standard spatial tiling.
pub fn validate_tile_coords(z: i32, x: i32, y: i32) -> Result<(i16, i32, i32), TileServiceError> {
    if z < 0 || z > i16::MAX as i32 {
        return Err(TileServiceError::InvalidCoordinates {
            message: format!("Invalid z={}: must be non-negative and <= {}", z, i16::MAX),
        });
    }

    let z_i16 = z as i16;

    if x < 0 {
        return Err(TileServiceError::InvalidCoordinates {
            message: format!("Invalid tile x={}: must be non-negative", x),
        });
    }

    if y < 0 {
        return Err(TileServiceError::InvalidCoordinates {
            message: format!("Invalid tile y={}: must be non-negative", y),
        });
    }

    Ok((z_i16, x, y))
}

/// Result of a tile query, including the actual z (time) value used.
#[derive(Debug, Serialize)]
pub struct TileResult {
    /// The actual time value of the returned tile (equals the z coordinate).
    pub actual_time: i32,
    /// The GeoJSON FeatureCollection.
    pub geojson: serde_json::Value,
}

/// Query a tile by (layer_id, z, x, y) and return a GeoJSON FeatureCollection
/// with embedded object references.
pub async fn get_tile(
    db: &DatabaseConnection,
    layer_id: &str,
    z: i16,
    x: i32,
    y: i32,
) -> Result<TileResult, TileServiceError> {
    let tile = find_tile_exact(db, layer_id, z, x, y).await?;
    let geojson = attach_object_refs(db, layer_id, tile.geojson).await?;
    Ok(TileResult { actual_time: z as i32, geojson })
}

/// Query a tile with time fallback.
///
/// - `time_fallback > 0`: if no exact match, find the nearest tile with z > time
/// - `time_fallback < 0`: if no exact match, find the nearest tile with z < time
/// - `time_fallback == 0` or `None`: exact match only (same as `get_tile`)
pub async fn get_tile_with_time(
    db: &DatabaseConnection,
    layer_id: &str,
    time: i16,
    x: i32,
    y: i32,
    time_fallback: i32,
) -> Result<TileResult, TileServiceError> {
    // Try exact match first
    match find_tile_exact(db, layer_id, time, x, y).await {
        Ok(tile) => {
            let geojson = attach_object_refs(db, layer_id, tile.geojson).await?;
            return Ok(TileResult { actual_time: time as i32, geojson });
        }
        Err(TileServiceError::NotFound { .. }) if time_fallback != 0 => {
            // Fall through to fallback search
        }
        Err(e) => return Err(e),
    }

    // Fallback: find nearest tile in the specified direction
    let tile_result = tokio::time::timeout(QUERY_TIMEOUT, async {
        let mut query = tiles::Entity::find()
            .filter(tiles::Column::LayerId.eq(layer_id))
            .filter(tiles::Column::X.eq(x))
            .filter(tiles::Column::Y.eq(y));

        if time_fallback > 0 {
            // Search forward: nearest z > time
            query = query
                .filter(tiles::Column::Z.gt(time))
                .order_by_asc(tiles::Column::Z);
        } else {
            // Search backward: nearest z < time
            query = query
                .filter(tiles::Column::Z.lt(time))
                .order_by_desc(tiles::Column::Z);
        }

        query.one(db).await
    })
    .await;

    let tile = match tile_result {
        Ok(Ok(Some(tile))) => tile,
        Ok(Ok(None)) => {
            return Err(TileServiceError::NotFound {
                layer_id: layer_id.to_string(),
                z: time,
                x,
                y,
            });
        }
        Ok(Err(e)) => return Err(TileServiceError::DatabaseError(e.to_string())),
        Err(_) => return Err(TileServiceError::QueryTimeout),
    };

    let actual_time = tile.z as i32;
    let geojson = attach_object_refs(db, layer_id, tile.geojson).await?;
    Ok(TileResult { actual_time, geojson })
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async fn find_tile_exact(
    db: &DatabaseConnection,
    layer_id: &str,
    z: i16,
    x: i32,
    y: i32,
) -> Result<tiles::Model, TileServiceError> {
    let result = tokio::time::timeout(QUERY_TIMEOUT, async {
        tiles::Entity::find()
            .filter(tiles::Column::LayerId.eq(layer_id))
            .filter(tiles::Column::Z.eq(z))
            .filter(tiles::Column::X.eq(x))
            .filter(tiles::Column::Y.eq(y))
            .one(db)
            .await
    })
    .await;

    match result {
        Ok(Ok(Some(tile))) => Ok(tile),
        Ok(Ok(None)) => Err(TileServiceError::NotFound {
            layer_id: layer_id.to_string(),
            z,
            x,
            y,
        }),
        Ok(Err(e)) => Err(TileServiceError::DatabaseError(e.to_string())),
        Err(_) => Err(TileServiceError::QueryTimeout),
    }
}

async fn attach_object_refs(
    db: &DatabaseConnection,
    layer_id: &str,
    geojson: serde_json::Value,
) -> Result<serde_json::Value, TileServiceError> {
    let refs_result = tokio::time::timeout(QUERY_TIMEOUT, async {
        object_references::Entity::find()
            .filter(object_references::Column::LayerId.eq(layer_id))
            .all(db)
            .await
    })
    .await;

    let object_refs = match refs_result {
        Ok(Ok(refs)) => refs,
        Ok(Err(e)) => return Err(TileServiceError::DatabaseError(e.to_string())),
        Err(_) => return Err(TileServiceError::QueryTimeout),
    };

    let embedded: Vec<EmbeddedObjectRef> = object_refs
        .into_iter()
        .map(|r| EmbeddedObjectRef {
            object_id: r.object_id,
            latitude: r.latitude,
            longitude: r.longitude,
            properties: r.properties,
        })
        .collect();

    Ok(embed_object_refs_in_geojson(geojson, &embedded))
}

/// Embed object references into a GeoJSON FeatureCollection.
///
/// If the tile's geojson already has features, adds `object_refs` to each feature's properties.
/// If there are no features but there are object references, they are added to the
/// FeatureCollection's top-level properties.
fn embed_object_refs_in_geojson(
    mut geojson: serde_json::Value,
    object_refs: &[EmbeddedObjectRef],
) -> serde_json::Value {
    if object_refs.is_empty() {
        return geojson;
    }

    let refs_json = serde_json::to_value(object_refs).unwrap_or(serde_json::Value::Array(vec![]));

    // If the geojson has features, embed object_refs in each feature's properties
    if let Some(features) = geojson.get_mut("features") {
        if let Some(features_arr) = features.as_array_mut() {
            for feature in features_arr.iter_mut() {
                if let Some(props) = feature.get_mut("properties") {
                    if let Some(props_obj) = props.as_object_mut() {
                        props_obj.insert("object_refs".to_string(), refs_json.clone());
                    }
                } else {
                    // Feature has no properties, create one with object_refs
                    if let Some(feature_obj) = feature.as_object_mut() {
                        let mut props = serde_json::Map::new();
                        props.insert("object_refs".to_string(), refs_json.clone());
                        feature_obj
                            .insert("properties".to_string(), serde_json::Value::Object(props));
                    }
                }
            }
        }
    }

    geojson
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_tile_coords_valid() {
        assert!(validate_tile_coords(0, 0, 0).is_ok());
        assert_eq!(validate_tile_coords(0, 0, 0).unwrap(), (0, 0, 0));

        assert!(validate_tile_coords(1, 0, 0).is_ok());
        assert!(validate_tile_coords(1, 1, 1).is_ok());

        assert!(validate_tile_coords(2, 3, 3).is_ok());
        assert_eq!(validate_tile_coords(2, 3, 3).unwrap(), (2, 3, 3));

        // Time-indexed tiles can have large z values
        assert!(validate_tile_coords(300, 0, 0).is_ok());
        assert_eq!(validate_tile_coords(300, 0, 0).unwrap(), (300, 0, 0));
    }

    #[test]
    fn test_validate_tile_coords_negative_z() {
        let result = validate_tile_coords(-1, 0, 0);
        assert!(result.is_err());
        match result.unwrap_err() {
            TileServiceError::InvalidCoordinates { message } => {
                assert!(message.contains("z=-1"));
            }
            _ => panic!("Expected InvalidCoordinates"),
        }
    }

    #[test]
    fn test_validate_tile_coords_x_out_of_range() {
        // Negative x is invalid
        let result = validate_tile_coords(0, -1, 0);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_tile_coords_y_out_of_range() {
        // Negative y is invalid
        let result = validate_tile_coords(1, 0, -1);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_tile_coords_negative_x() {
        let result = validate_tile_coords(2, -1, 0);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_tile_coords_negative_y() {
        let result = validate_tile_coords(2, 0, -1);
        assert!(result.is_err());
    }

    #[test]
    fn test_error_status_codes() {
        let not_found = TileServiceError::NotFound {
            layer_id: "test".to_string(),
            z: 0,
            x: 0,
            y: 0,
        };
        assert_eq!(not_found.status_code(), StatusCode::NOT_FOUND);
        assert_eq!(not_found.error_code(), "TILE_NOT_FOUND");
        assert!(not_found.retry_after().is_none());

        let invalid = TileServiceError::InvalidCoordinates {
            message: "bad".to_string(),
        };
        assert_eq!(invalid.status_code(), StatusCode::BAD_REQUEST);
        assert_eq!(invalid.error_code(), "INVALID_COORDINATES");

        let timeout = TileServiceError::QueryTimeout;
        assert_eq!(timeout.status_code(), StatusCode::GATEWAY_TIMEOUT);
        assert_eq!(timeout.error_code(), "QUERY_TIMEOUT");
        assert_eq!(timeout.retry_after(), Some(5));

        let db_err = TileServiceError::DatabaseError("fail".to_string());
        assert_eq!(db_err.status_code(), StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(db_err.error_code(), "INTERNAL_ERROR");
    }

    #[test]
    fn test_embed_object_refs_empty_refs() {
        let geojson = serde_json::json!({
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [0.0, 0.0]},
                    "properties": {"name": "test"}
                }
            ]
        });

        let result = embed_object_refs_in_geojson(geojson.clone(), &[]);
        assert_eq!(result, geojson); // No change when refs are empty
    }

    #[test]
    fn test_embed_object_refs_into_features() {
        let geojson = serde_json::json!({
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [2.3522, 48.8566]},
                    "properties": {"name": "Paris"}
                }
            ]
        });

        let refs = vec![EmbeddedObjectRef {
            object_id: "napoleon".to_string(),
            latitude: 48.8566,
            longitude: 2.3522,
            properties: serde_json::json!({"title": "拿破仑", "year": 1804}),
        }];

        let result = embed_object_refs_in_geojson(geojson, &refs);

        let features = result["features"].as_array().unwrap();
        assert_eq!(features.len(), 1);

        let props = &features[0]["properties"];
        assert_eq!(props["name"], "Paris");

        let obj_refs = props["object_refs"].as_array().unwrap();
        assert_eq!(obj_refs.len(), 1);
        assert_eq!(obj_refs[0]["object_id"], "napoleon");
        assert_eq!(obj_refs[0]["latitude"], 48.8566);
        assert_eq!(obj_refs[0]["longitude"], 2.3522);
    }

    #[test]
    fn test_embed_object_refs_feature_without_properties() {
        let geojson = serde_json::json!({
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [0.0, 0.0]}
                }
            ]
        });

        let refs = vec![EmbeddedObjectRef {
            object_id: "obj1".to_string(),
            latitude: 0.0,
            longitude: 0.0,
            properties: serde_json::json!({}),
        }];

        let result = embed_object_refs_in_geojson(geojson, &refs);

        let features = result["features"].as_array().unwrap();
        let props = &features[0]["properties"];
        let obj_refs = props["object_refs"].as_array().unwrap();
        assert_eq!(obj_refs.len(), 1);
        assert_eq!(obj_refs[0]["object_id"], "obj1");
    }
}
