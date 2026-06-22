use crate::db::models::DailyStory;
use crate::error::AppResult;
use crate::services::story_service;
use crate::AppState;
use tauri::State;

#[tauri::command]
pub async fn story_get_today(state: State<'_, AppState>) -> AppResult<DailyStory> {
    let story = story_service::get_or_generate_today(&state.db).await?;
    crate::services::analytics_service::track(
        &state.db, "story_viewed", serde_json::json!({ "storyDate": story.story_date }),
    ).await?;
    Ok(story)
}

#[tauri::command]
pub async fn story_regenerate(state: State<'_, AppState>) -> AppResult<DailyStory> {
    let cat: crate::db::models::CatState = sqlx::query_as("SELECT * FROM cat_state WHERE id = 1")
        .fetch_one(&state.db)
        .await?;
    if cat.tier != "pro" {
        return Err(crate::error::AppError::InvalidInput("story_regenerate is a Pro feature".into()));
    }
    story_service::regenerate_today(&state.db).await
}
