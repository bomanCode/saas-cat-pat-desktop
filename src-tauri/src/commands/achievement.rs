use crate::db::models::AchievementWithProgress;
use crate::error::AppResult;
use crate::services::achievement_service;
use crate::AppState;
use tauri::State;

#[tauri::command]
pub async fn achievement_list(state: State<'_, AppState>) -> AppResult<Vec<AchievementWithProgress>> {
    achievement_service::list_with_progress(&state.db).await
}
