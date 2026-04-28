use sea_orm::sea_query::Index;
use sea_orm::{ConnectionTrait, DbErr, Schema};

use crate::entities;

/// Create all database tables with proper indexes and foreign keys.
pub async fn create_tables(db: &impl ConnectionTrait) -> Result<(), DbErr> {
    let schema = Schema::new(db.get_database_backend());

    // Create layer_groups table first (referenced by layers)
    let layer_groups_stmt = schema.create_table_from_entity(entities::layer_groups::Entity);
    db.execute(db.get_database_backend().build(&layer_groups_stmt))
        .await?;

    // Create objects table (referenced by object_references)
    let objects_stmt = schema.create_table_from_entity(entities::objects::Entity);
    db.execute(db.get_database_backend().build(&objects_stmt))
        .await?;

    // Create layers table with foreign key to layer_groups
    let layers_stmt = schema.create_table_from_entity(entities::layers::Entity);
    db.execute(db.get_database_backend().build(&layers_stmt))
        .await?;

    // Create tiles table with foreign key to layers
    let tiles_stmt = schema.create_table_from_entity(entities::tiles::Entity);
    db.execute(db.get_database_backend().build(&tiles_stmt))
        .await?;

    // Create index on (layer_id, time_year) for time-series queries
    let tiles_time_idx = Index::create()
        .name("idx_tiles_layer_time")
        .table(entities::tiles::Entity)
        .col(entities::tiles::Column::LayerId)
        .col(entities::tiles::Column::TimeYear)
        .to_owned();
    db.execute(db.get_database_backend().build(&tiles_time_idx))
        .await?;

    // Create index on (layer_id, z, x, y) for spatial queries
    // Note: Not unique anymore since time-series data can have multiple tiles at z=0
    let tiles_spatial_idx = Index::create()
        .name("idx_tiles_layer_z_x_y")
        .table(entities::tiles::Entity)
        .col(entities::tiles::Column::LayerId)
        .col(entities::tiles::Column::Z)
        .col(entities::tiles::Column::X)
        .col(entities::tiles::Column::Y)
        .to_owned();
    db.execute(db.get_database_backend().build(&tiles_spatial_idx))
        .await?;

    // Create object_references table with foreign keys to objects and layers
    let object_refs_stmt =
        schema.create_table_from_entity(entities::object_references::Entity);
    db.execute(db.get_database_backend().build(&object_refs_stmt))
        .await?;

    // Create index on (layer_id, object_id) for object_references
    let obj_refs_idx = Index::create()
        .name("idx_object_references_layer_object")
        .table(entities::object_references::Entity)
        .col(entities::object_references::Column::LayerId)
        .col(entities::object_references::Column::ObjectId)
        .to_owned();
    db.execute(db.get_database_backend().build(&obj_refs_idx))
        .await?;

    Ok(())
}
