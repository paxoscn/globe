use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "layers")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false, column_type = "String(StringLen::N(64))")]
    pub id: String,
    #[sea_orm(column_type = "String(StringLen::N(255))")]
    pub name: String,
    #[sea_orm(column_type = "Text")]
    pub description: String,
    #[sea_orm(column_type = "String(StringLen::N(64))", nullable)]
    pub group_id: Option<String>,
    pub order_in_group: i32,
    pub created_at: DateTimeUtc,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::layer_groups::Entity",
        from = "Column::GroupId",
        to = "super::layer_groups::Column::Id"
    )]
    LayerGroup,
    #[sea_orm(has_many = "super::tiles::Entity")]
    Tiles,
    #[sea_orm(has_many = "super::object_references::Entity")]
    ObjectReferences,
}

impl Related<super::layer_groups::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::LayerGroup.def()
    }
}

impl Related<super::tiles::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Tiles.def()
    }
}

impl Related<super::object_references::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::ObjectReferences.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
