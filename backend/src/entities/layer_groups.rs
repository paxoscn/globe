use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "layer_groups")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false, column_type = "String(StringLen::N(64))")]
    pub id: String,
    #[sea_orm(column_type = "String(StringLen::N(255))")]
    pub name: String,
    #[sea_orm(column_type = "Text")]
    pub description: String,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::layers::Entity")]
    Layers,
}

impl Related<super::layers::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Layers.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
