use axum::http::StatusCode;
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder};
use serde::Serialize;
use std::collections::{HashMap, HashSet};

use crate::entities::{layer_groups, layers, object_references, objects};

/// Error types returned by the layer service.
#[derive(Debug)]
pub enum LayerServiceError {
    /// Object not found.
    ObjectNotFound { object_id: String },
    /// Internal database error.
    DatabaseError(String),
}

impl LayerServiceError {
    pub fn status_code(&self) -> StatusCode {
        match self {
            LayerServiceError::ObjectNotFound { .. } => StatusCode::NOT_FOUND,
            LayerServiceError::DatabaseError(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    pub fn error_code(&self) -> &str {
        match self {
            LayerServiceError::ObjectNotFound { .. } => "OBJECT_NOT_FOUND",
            LayerServiceError::DatabaseError(_) => "INTERNAL_ERROR",
        }
    }

    pub fn message(&self) -> String {
        match self {
            LayerServiceError::ObjectNotFound { object_id } => {
                format!("Object '{}' not found", object_id)
            }
            LayerServiceError::DatabaseError(msg) => {
                format!("Internal database error: {}", msg)
            }
        }
    }
}

/// A layer entry in the GET /api/layers response.
#[derive(Debug, Serialize, Clone)]
pub struct LayerResponse {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub group_id: Option<String>,
    pub lod_levels: Vec<i32>,
    pub object_refs: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timeline_config: Option<serde_json::Value>,
}

/// A layer group entry in the GET /api/layers response.
#[derive(Debug, Serialize, Clone)]
pub struct LayerGroupResponse {
    pub id: String,
    pub name: String,
    pub layer_ids: Vec<String>,
}

/// The full GET /api/layers response.
#[derive(Debug, Serialize)]
pub struct AllLayersResponse {
    pub layers: Vec<LayerResponse>,
    pub groups: Vec<LayerGroupResponse>,
}

/// An object reference entry in the GET /api/objects/:object_id response.
#[derive(Debug, Serialize, Clone)]
pub struct ObjectReferenceResponse {
    pub layer_id: String,
    pub latitude: f64,
    pub longitude: f64,
    pub properties: serde_json::Value,
}

/// The full GET /api/objects/:object_id response.
#[derive(Debug, Serialize)]
pub struct ObjectResponse {
    pub id: String,
    pub name: String,
    pub description: String,
    pub references: Vec<ObjectReferenceResponse>,
}

/// Query all layers and layer groups, building the hierarchy with object refs and LOD levels.
pub async fn get_all_layers(
    db: &DatabaseConnection,
) -> Result<AllLayersResponse, LayerServiceError> {
    // Fetch all layers ordered by group and position within group
    let all_layers = layers::Entity::find()
        .order_by_asc(layers::Column::GroupId)
        .order_by_asc(layers::Column::OrderInGroup)
        .all(db)
        .await
        .map_err(|e| LayerServiceError::DatabaseError(e.to_string()))?;

    // Fetch all layer groups
    let all_groups = layer_groups::Entity::find()
        .all(db)
        .await
        .map_err(|e| LayerServiceError::DatabaseError(e.to_string()))?;

    // Fetch all object references to build per-layer object ref lists
    let all_obj_refs = object_references::Entity::find()
        .all(db)
        .await
        .map_err(|e| LayerServiceError::DatabaseError(e.to_string()))?;

    // Fetch all tiles to determine LOD levels per layer (distinct z values)
    let all_tiles = crate::entities::tiles::Entity::find()
        .all(db)
        .await
        .map_err(|e| LayerServiceError::DatabaseError(e.to_string()))?;

    // Build a map of layer_id -> set of distinct z (LOD) levels
    let mut lod_map: HashMap<String, HashSet<i32>> = HashMap::new();
    for tile in &all_tiles {
        lod_map
            .entry(tile.layer_id.clone())
            .or_default()
            .insert(tile.z as i32);
    }

    // Build a map of layer_id -> set of distinct object_ids
    let mut obj_ref_map: HashMap<String, HashSet<String>> = HashMap::new();
    for obj_ref in &all_obj_refs {
        obj_ref_map
            .entry(obj_ref.layer_id.clone())
            .or_default()
            .insert(obj_ref.object_id.clone());
    }

    // Build layer responses
    let layer_responses: Vec<LayerResponse> = all_layers
        .iter()
        .map(|layer| {
            let mut lod_levels: Vec<i32> = lod_map
                .get(&layer.id)
                .map(|s| s.iter().copied().collect())
                .unwrap_or_default();
            lod_levels.sort();

            let mut object_refs: Vec<String> = obj_ref_map
                .get(&layer.id)
                .map(|s| s.iter().cloned().collect())
                .unwrap_or_default();
            object_refs.sort();

            LayerResponse {
                id: layer.id.clone(),
                name: layer.name.clone(),
                group_id: layer.group_id.clone(),
                lod_levels,
                object_refs,
                timeline_config: layer.timeline_config.clone(),
            }
        })
        .collect();

    // Build group responses with ordered layer_ids
    let mut group_layers_map: HashMap<String, Vec<(i32, String)>> = HashMap::new();
    for layer in &all_layers {
        if let Some(ref gid) = layer.group_id {
            group_layers_map
                .entry(gid.clone())
                .or_default()
                .push((layer.order_in_group, layer.id.clone()));
        }
    }

    let group_responses: Vec<LayerGroupResponse> = all_groups
        .iter()
        .map(|group| {
            let mut layer_entries = group_layers_map
                .get(&group.id)
                .cloned()
                .unwrap_or_default();
            layer_entries.sort_by_key(|(order, _)| *order);
            let layer_ids: Vec<String> = layer_entries.into_iter().map(|(_, id)| id).collect();

            LayerGroupResponse {
                id: group.id.clone(),
                name: group.name.clone(),
                layer_ids,
            }
        })
        .collect();

    Ok(AllLayersResponse {
        layers: layer_responses,
        groups: group_responses,
    })
}

/// Query an object by ID and return its details with all references.
pub async fn get_object(
    db: &DatabaseConnection,
    object_id: &str,
) -> Result<ObjectResponse, LayerServiceError> {
    // Find the object
    let object = objects::Entity::find_by_id(object_id.to_string())
        .one(db)
        .await
        .map_err(|e| LayerServiceError::DatabaseError(e.to_string()))?
        .ok_or_else(|| LayerServiceError::ObjectNotFound {
            object_id: object_id.to_string(),
        })?;

    // Find all references for this object
    let refs = object_references::Entity::find()
        .filter(object_references::Column::ObjectId.eq(object_id))
        .all(db)
        .await
        .map_err(|e| LayerServiceError::DatabaseError(e.to_string()))?;

    let references: Vec<ObjectReferenceResponse> = refs
        .into_iter()
        .map(|r| ObjectReferenceResponse {
            layer_id: r.layer_id,
            latitude: r.latitude,
            longitude: r.longitude,
            properties: r.properties,
        })
        .collect();

    Ok(ObjectResponse {
        id: object.id,
        name: object.name,
        description: object.description,
        references,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use sea_orm::{ActiveModelTrait, Database, Set};

    /// Helper to create an in-memory SQLite database with schema.
    async fn setup_test_db() -> DatabaseConnection {
        let db = Database::connect("sqlite::memory:")
            .await
            .expect("failed to connect to test db");
        crate::schema::create_tables(&db)
            .await
            .expect("failed to create tables");
        db
    }

    #[tokio::test]
    async fn test_get_all_layers_empty() {
        let db = setup_test_db().await;
        let result = get_all_layers(&db).await.unwrap();
        assert!(result.layers.is_empty());
        assert!(result.groups.is_empty());
    }

    #[tokio::test]
    async fn test_get_all_layers_with_data() {
        let db = setup_test_db().await;

        // Insert a layer group
        layer_groups::ActiveModel {
            id: Set("historical-coastlines".to_string()),
            name: Set("历史海岸线".to_string()),
            description: Set("Historical coastline data".to_string()),
        }
        .insert(&db)
        .await
        .unwrap();

        // Insert layers
        layers::ActiveModel {
            id: Set("coastline-1800".to_string()),
            name: Set("1800年海岸线".to_string()),
            description: Set("Coastline in 1800".to_string()),
            group_id: Set(Some("historical-coastlines".to_string())),
            order_in_group: Set(0),
            created_at: Set(chrono::Utc::now()),
            timeline_config: Set(None),
        }
        .insert(&db)
        .await
        .unwrap();

        layers::ActiveModel {
            id: Set("coastline-1850".to_string()),
            name: Set("1850年海岸线".to_string()),
            description: Set("Coastline in 1850".to_string()),
            group_id: Set(Some("historical-coastlines".to_string())),
            order_in_group: Set(1),
            created_at: Set(chrono::Utc::now()),
            timeline_config: Set(None),
        }
        .insert(&db)
        .await
        .unwrap();

        // Insert an object and reference
        objects::ActiveModel {
            id: Set("napoleon".to_string()),
            name: Set("拿破仑".to_string()),
            description: Set("Napoleon Bonaparte".to_string()),
        }
        .insert(&db)
        .await
        .unwrap();

        object_references::ActiveModel {
            id: sea_orm::NotSet,
            object_id: Set("napoleon".to_string()),
            layer_id: Set("coastline-1800".to_string()),
            latitude: Set(48.8566),
            longitude: Set(2.3522),
            properties: Set(serde_json::json!({"title": "加冕", "year": 1804})),
        }
        .insert(&db)
        .await
        .unwrap();

        let result = get_all_layers(&db).await.unwrap();

        // Check layers
        assert_eq!(result.layers.len(), 2);
        let layer_1800 = result.layers.iter().find(|l| l.id == "coastline-1800").unwrap();
        assert_eq!(layer_1800.name, "1800年海岸线");
        assert_eq!(layer_1800.group_id, Some("historical-coastlines".to_string()));
        assert_eq!(layer_1800.object_refs, vec!["napoleon".to_string()]);

        let layer_1850 = result.layers.iter().find(|l| l.id == "coastline-1850").unwrap();
        assert!(layer_1850.object_refs.is_empty());

        // Check groups
        assert_eq!(result.groups.len(), 1);
        let group = &result.groups[0];
        assert_eq!(group.id, "historical-coastlines");
        assert_eq!(group.name, "历史海岸线");
        assert_eq!(group.layer_ids, vec!["coastline-1800", "coastline-1850"]);
    }

    #[tokio::test]
    async fn test_get_object_found() {
        let db = setup_test_db().await;

        // Insert a layer (needed for FK)
        layer_groups::ActiveModel {
            id: Set("grp".to_string()),
            name: Set("Group".to_string()),
            description: Set("".to_string()),
        }
        .insert(&db)
        .await
        .unwrap();

        layers::ActiveModel {
            id: Set("layer-1".to_string()),
            name: Set("Layer 1".to_string()),
            description: Set("".to_string()),
            group_id: Set(Some("grp".to_string())),
            order_in_group: Set(0),
            created_at: Set(chrono::Utc::now()),
            timeline_config: Set(None),
        }
        .insert(&db)
        .await
        .unwrap();

        // Insert object
        objects::ActiveModel {
            id: Set("napoleon".to_string()),
            name: Set("拿破仑".to_string()),
            description: Set("Napoleon Bonaparte".to_string()),
        }
        .insert(&db)
        .await
        .unwrap();

        // Insert references
        object_references::ActiveModel {
            id: sea_orm::NotSet,
            object_id: Set("napoleon".to_string()),
            layer_id: Set("layer-1".to_string()),
            latitude: Set(48.8566),
            longitude: Set(2.3522),
            properties: Set(serde_json::json!({"title": "加冕", "year": 1804})),
        }
        .insert(&db)
        .await
        .unwrap();

        let result = get_object(&db, "napoleon").await.unwrap();
        assert_eq!(result.id, "napoleon");
        assert_eq!(result.name, "拿破仑");
        assert_eq!(result.description, "Napoleon Bonaparte");
        assert_eq!(result.references.len(), 1);
        assert_eq!(result.references[0].layer_id, "layer-1");
        assert_eq!(result.references[0].latitude, 48.8566);
        assert_eq!(result.references[0].longitude, 2.3522);
        assert_eq!(result.references[0].properties["title"], "加冕");
    }

    #[tokio::test]
    async fn test_get_object_not_found() {
        let db = setup_test_db().await;
        let result = get_object(&db, "nonexistent").await;
        assert!(result.is_err());
        match result.unwrap_err() {
            LayerServiceError::ObjectNotFound { object_id } => {
                assert_eq!(object_id, "nonexistent");
            }
            _ => panic!("Expected ObjectNotFound"),
        }
    }
}
