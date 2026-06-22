use crate::db::models::AiMemoryEntry;
use crate::error::AppResult;
use crate::services::memory_service;
use crate::AppState;
use tauri::State;

#[tauri::command]
pub async fn memory_save(
    state: State<'_, AppState>,
    kind: String,
    content: String,
    source_provider: Option<String>,
    tags: Option<Vec<String>>,
) -> AppResult<AiMemoryEntry> {
    let entry = memory_service::save(
        &state.db,
        &kind,
        &content,
        source_provider.as_deref(),
        &tags.unwrap_or_default(),
    )
    .await?;

    crate::services::analytics_service::track(
        &state.db, "ai_response_saved", serde_json::json!({ "kind": entry.kind }),
    ).await?;

    let unlocked = crate::services::achievement_service::evaluate_all(&state.db).await?;
    for a in &unlocked {
        crate::services::analytics_service::track(
            &state.db, "achievement_unlocked", serde_json::json!({ "id": a.id, "xpAwarded": a.xp_reward }),
        ).await?;
    }

    Ok(entry)
}

#[tauri::command]
pub async fn memory_search(state: State<'_, AppState>, query: String, tag: Option<String>) -> AppResult<Vec<AiMemoryEntry>> {
    memory_service::search(&state.db, &query, tag.as_deref(), 50).await
}

#[tauri::command]
pub async fn memory_delete(state: State<'_, AppState>, id: i64) -> AppResult<()> {
    memory_service::delete(&state.db, id).await
}

#[tauri::command]
pub async fn memory_list_tags(state: State<'_, AppState>) -> AppResult<Vec<String>> {
    memory_service::list_tags(&state.db).await
}
