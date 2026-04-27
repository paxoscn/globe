mod entities;
mod routes;
mod schema;
mod services;

use axum::{routing::get, Router};
use sea_orm::DatabaseConnection;
use tower_http::compression::CompressionLayer;
use tower_http::cors::CorsLayer;

/// Shared application state holding the database connection.
#[derive(Clone)]
pub struct AppState {
    pub db: DatabaseConnection,
}

async fn health() -> &'static str {
    "ok"
}

#[tokio::main]
async fn main() {
    // Create an in-memory SQLite database as a placeholder.
    // A real database connection will be configured later.
    let db = sea_orm::Database::connect("sqlite::memory:")
        .await
        .expect("failed to connect to database");

    // Initialize database schema
    schema::create_tables(&db)
        .await
        .expect("failed to create tables");

    let state = AppState { db };

    let app = Router::new()
        .route("/health", get(health))
        .merge(routes::api_router())
        .with_state(state)
        .layer(CorsLayer::permissive())
        .layer(CompressionLayer::new());

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3001")
        .await
        .expect("failed to bind");

    println!("Backend listening on http://0.0.0.0:3001");
    axum::serve(listener, app).await.expect("server error");
}
