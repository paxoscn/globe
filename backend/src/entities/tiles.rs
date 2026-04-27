use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "tiles")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    #[sea_orm(column_type = "String(StringLen::N(64))")]
    pub layer_id: String,
    pub z: i16,
    pub x: i32,
    pub y: i32,
    #[sea_orm(column_type = "JsonBinary")]
    pub geojson: serde_json::Value,
    pub size_bytes: i32,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::layers::Entity",
        from = "Column::LayerId",
        to = "super::layers::Column::Id"
    )]
    Layer,
}

impl Related<super::layers::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Layer.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
