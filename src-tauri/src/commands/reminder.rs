use crate::db::models::Reminder;
use crate::error::AppResult;
use crate::services::reminder_service::{self, RepeatRule};
use crate::AppState;
use tauri::State;

#[tauri::command]
pub async fn reminder_create(
    state: State<'_, AppState>,
    title: String,
    body_template: String,
    repeat_rule: RepeatRule,
    first_fire_at: i64,
) -> AppResult<Reminder> {
    reminder_service::create(&state.db, title, body_template, repeat_rule, first_fire_at).await
}

#[tauri::command]
pub async fn reminder_list(state: State<'_, AppState>) -> AppResult<Vec<Reminder>> {
    reminder_service::list(&state.db).await
}

#[tauri::command]
pub async fn reminder_update(
    state: State<'_, AppState>,
    id: i64,
    title: Option<String>,
    body_template: Option<String>,
    is_active: Option<bool>,
) -> AppResult<Reminder> {
    reminder_service::update(&state.db, id, title, body_template, is_active).await
}

#[tauri::command]
pub async fn reminder_delete(state: State<'_, AppState>, id: i64) -> AppResult<()> {
    reminder_service::delete(&state.db, id).await
}
