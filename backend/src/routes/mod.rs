use axum::{
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};

use crate::services::{layer_service, tile_service};
use crate::AppState;

/// Standardized error response matching the design doc format.
#[derive(Serialize)]
pub struct ErrorResponse {
    pub error: ErrorDetail,
}

#[derive(Serialize)]
pub struct ErrorDetail {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retry_after: Option<u64>,
}

impl ErrorResponse {
    fn from_tile_error(err: &tile_service::TileServiceError) -> (StatusCode, Json<ErrorResponse>) {
        (
            err.status_code(),
            Json(ErrorResponse {
                error: ErrorDetail {
                    code: err.error_code().to_string(),
                    message: err.message(),
                    retry_after: err.retry_after(),
                },
            }),
        )
    }

    fn not_found(code: &str, message: &str) -> (StatusCode, Json<ErrorResponse>) {
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: ErrorDetail {
                    code: code.to_string(),
                    message: message.to_string(),
                    retry_after: None,
                },
            }),
        )
    }

    fn from_layer_error(err: &layer_service::LayerServiceError) -> (StatusCode, Json<ErrorResponse>) {
        (
            err.status_code(),
            Json(ErrorResponse {
                error: ErrorDetail {
                    code: err.error_code().to_string(),
                    message: err.message(),
                    retry_after: None,
                },
            }),
        )
    }
}

/// GeoJSON response headers: Content-Type: application/geo+json, Cache-Control: public, max-age=3600
fn geojson_response(body: serde_json::Value) -> Response {
    (
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "application/geo+json"),
            (header::CACHE_CONTROL, "public, max-age=3600"),
        ],
        Json(body),
    )
        .into_response()
}

/// JSON response with Cache-Control header for metadata endpoints.
fn json_response(body: serde_json::Value) -> Response {
    (
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "application/json"),
            (header::CACHE_CONTROL, "public, max-age=3600"),
        ],
        Json(body),
    )
        .into_response()
}

/// Build the API router with all tile, layer, and object routes.
pub fn api_router() -> Router<AppState> {
    Router::new()
        .route("/api/tiles/{layer_id}/{z}/{x}/{y}", get(get_tile))
        .route("/api/layers", get(get_layers))
        .route("/api/objects/{object_id}", get(get_object))
}

/// Query parameters for tile endpoint.
#[derive(Debug, Deserialize)]
pub struct TileQuery {
    /// Optional absolute CE year for time-series layers.
    /// When provided, queries by time_year instead of z coordinate.
    pub time_year: Option<f64>,
    /// Fallback direction when no exact time match exists.
    /// Positive: find nearest tile with time_year > requested.
    /// Negative: find nearest tile with time_year < requested.
    /// Zero or absent: exact match only.
    pub time_fallback: Option<i32>,
}

/// GET /api/tiles/{layer_id}/{z}/{x}/{y}?time_year={year}&time_fallback={dir}
///
/// Returns a JSON envelope with `actual_time_year` and `geojson` fields.
/// If `?time_year=` is provided, it queries by time_year instead of z coordinate.
/// If `?time_fallback=` is provided and no exact match, searches in the
/// specified direction for the nearest available time.
async fn get_tile(
    State(state): State<AppState>,
    Path((layer_id, z, x, y)): Path<(String, i32, i32, i32)>,
    Query(query): Query<TileQuery>,
) -> Result<Response, (StatusCode, Json<ErrorResponse>)> {
    let (z_valid, x_valid, y_valid) =
        tile_service::validate_tile_coords(z, x, y)
            .map_err(|e| ErrorResponse::from_tile_error(&e))?;

    let result = if let Some(time_year) = query.time_year {
        // Query by time_year
        let fallback = query.time_fallback.unwrap_or(0);
        tile_service::get_tile_by_time_year(&state.db, &layer_id, time_year, x_valid, y_valid, fallback)
            .await
            .map_err(|e| ErrorResponse::from_tile_error(&e))?
    } else {
        // Query by z coordinate (spatial LOD)
        tile_service::get_tile(&state.db, &layer_id, z_valid, x_valid, y_valid)
            .await
            .map_err(|e| ErrorResponse::from_tile_error(&e))?
    };

    // Return envelope with actual_time_year so the client can detect unchanged data
    let body = serde_json::json!({
        "actual_time_year": result.actual_time_year,
        "geojson": result.geojson,
    });

    Ok(json_response(body))
}

/// GET /api/layers
///
/// Returns layer and layer group metadata.
async fn get_layers(
    State(state): State<AppState>,
) -> Result<Response, (StatusCode, Json<ErrorResponse>)> {
    let result = layer_service::get_all_layers(&state.db)
        .await
        .map_err(|e| ErrorResponse::from_layer_error(&e))?;

    let body = serde_json::to_value(&result)
        .map_err(|e| {
            ErrorResponse::from_layer_error(&layer_service::LayerServiceError::DatabaseError(
                e.to_string(),
            ))
        })?;

    Ok(json_response(body))
}

/// GET /api/objects/{object_id}
///
/// Returns object details with its references across layers.
async fn get_object(
    State(state): State<AppState>,
    Path(object_id): Path<String>,
) -> Result<Response, (StatusCode, Json<ErrorResponse>)> {
    let result = layer_service::get_object(&state.db, &object_id)
        .await
        .map_err(|e| ErrorResponse::from_layer_error(&e))?;

    let body = serde_json::to_value(&result)
        .map_err(|e| {
            ErrorResponse::from_layer_error(&layer_service::LayerServiceError::DatabaseError(
                e.to_string(),
            ))
        })?;

    Ok(json_response(body))
}

#[cfg(test)]
mod tests {
    use crate::services::tile_service::{validate_tile_coords, TileServiceError};

    #[test]
    fn test_validate_tile_coords_valid() {
        assert!(validate_tile_coords(0, 0, 0).is_ok());
        assert!(validate_tile_coords(1, 0, 0).is_ok());
        assert!(validate_tile_coords(1, 1, 1).is_ok());
        assert!(validate_tile_coords(2, 3, 3).is_ok());
        // Time-indexed tiles
        assert!(validate_tile_coords(300, 0, 0).is_ok());
    }

    #[test]
    fn test_validate_tile_coords_negative_z() {
        let result = validate_tile_coords(-1, 0, 0);
        assert!(result.is_err());
        match result.unwrap_err() {
            TileServiceError::InvalidCoordinates { .. } => {}
            _ => panic!("Expected InvalidCoordinates"),
        }
    }

    #[test]
    fn test_validate_tile_coords_x_out_of_range() {
        let result = validate_tile_coords(0, -1, 0);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_tile_coords_y_out_of_range() {
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
}
