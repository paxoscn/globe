use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "object_references")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    #[sea_orm(column_type = "String(StringLen::N(64))")]
    pub object_id: String,
    #[sea_orm(column_type = "String(StringLen::N(64))")]
    pub layer_id: String,
    #[sea_orm(column_type = "Double")]
    pub latitude: f64,
    #[sea_orm(column_type = "Double")]
    pub longitude: f64,
    #[sea_orm(column_type = "JsonBinary")]
    pub properties: serde_json::Value,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::objects::Entity",
        from = "Column::ObjectId",
        to = "super::objects::Column::Id"
    )]
    Object,
    #[sea_orm(
        belongs_to = "super::layers::Entity",
        from = "Column::LayerId",
        to = "super::layers::Column::Id"
    )]
    Layer,
}

impl Related<super::objects::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Object.def()
    }
}

impl Related<super::layers::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Layer.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
