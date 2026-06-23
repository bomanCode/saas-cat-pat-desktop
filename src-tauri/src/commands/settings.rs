use crate::error::AppResult;
use crate::AppState;
use serde_json::Value;
use std::collections::HashMap;
use tauri::State;

#[tauri::command]
pub async fn settings_get(state: State<'_, AppState>) -> AppResult<HashMap<String, Value>> {
    let rows: Vec<(String, String)> = sqlx::query_as("SELECT key, value FROM app_settings")
        .fetch_all(&state.db)
        .await?;
    Ok(rows
        .into_iter()
        .map(|(k, v)| (k, serde_json::from_str(&v).unwrap_or(Value::Null)))
        .collect())
}

#[tauri::command]
pub async fn settings_update(state: State<'_, AppState>, key: String, value: Value) -> AppResult<()> {
    let value_json = serde_json::to_string(&value).map_err(|e| crate::error::AppError::InvalidInput(e.to_string()))?;
    sqlx::query("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .bind(&key)
        .bind(&value_json)
        .execute(&state.db)
        .await?;
    Ok(())
}
