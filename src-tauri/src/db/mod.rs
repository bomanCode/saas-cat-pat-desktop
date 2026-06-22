use crate::error::{AppError, AppResult};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::path::PathBuf;
use std::str::FromStr;

pub mod models;

/// Resolves `$APPDATA/comnyang/comnyang.db`, creating the directory if needed.
/// Falls back to the current working directory in dev/test if no platform
/// data dir is resolvable (e.g. headless CI containers).
pub fn db_path() -> PathBuf {
    let base = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    let dir = base.join("comnyang");
    if !dir.exists() {
        let _ = std::fs::create_dir_all(&dir);
    }
    dir.join("comnyang.db")
}

pub async fn init_pool(path: &PathBuf) -> AppResult<SqlitePool> {
    let conn_str = format!("sqlite://{}", path.to_string_lossy());
    let opts = SqliteConnectOptions::from_str(&conn_str)
        .map_err(|e| AppError::Internal(e.to_string()))?
        .create_if_missing(true)
        .foreign_keys(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(8)
        .connect_with(opts)
        .await?;

    sqlx::migrate!("../db/migrations").run(&pool).await
        .map_err(|e| AppError::Internal(format!("migration failed: {e}")))?;

    Ok(pool)
}

#[cfg(test)]
pub async fn init_test_pool() -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("in-memory sqlite pool");
    sqlx::migrate!("../db/migrations")
        .run(&pool)
        .await
        .expect("migrations on in-memory db");
    pool
}
