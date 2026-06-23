use crate::db::models::CatState;
use crate::error::AppResult;
use crate::services::{personality_service::Personality, xp_service};
use crate::AppState;
use serde::Serialize;
use tauri::{Emitter, State};

#[tauri::command]
pub async fn cat_get_state(state: State<'_, AppState>) -> AppResult<CatState> {
    sqlx::query_as("SELECT * FROM cat_state WHERE id = 1")
        .fetch_one(&state.db)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn cat_set_personality(
    state: State<'_, AppState>,
    personality: String,
) -> AppResult<CatState> {
    let parsed = Personality::from_str(&personality)
        .ok_or_else(|| crate::error::AppError::InvalidInput(format!("unknown personality: {personality}")))?;

    let previous: CatState = sqlx::query_as("SELECT * FROM cat_state WHERE id = 1")
        .fetch_one(&state.db)
        .await?;

    sqlx::query("UPDATE cat_state SET personality = ?, updated_at = unixepoch() WHERE id = 1")
        .bind(parsed.as_str())
        .execute(&state.db)
        .await?;

    crate::services::analytics_service::track(
        &state.db,
        "personality_changed",
        serde_json::json!({ "from": previous.personality, "to": parsed.as_str() }),
    )
    .await?;

    sqlx::query_as("SELECT * FROM cat_state WHERE id = 1")
        .fetch_one(&state.db)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn cat_rename(state: State<'_, AppState>, name: String) -> AppResult<CatState> {
    if name.trim().is_empty() || name.len() > 32 {
        return Err(crate::error::AppError::InvalidInput("name must be 1-32 characters".into()));
    }
    sqlx::query("UPDATE cat_state SET name = ?, updated_at = unixepoch() WHERE id = 1")
        .bind(name.trim())
        .execute(&state.db)
        .await?;
    sqlx::query_as("SELECT * FROM cat_state WHERE id = 1")
        .fetch_one(&state.db)
        .await
        .map_err(Into::into)
}

#[derive(Serialize)]
pub struct XpAwardResponse {
    pub cat_state: CatState,
    pub leveled_up: bool,
}

#[tauri::command]
pub async fn xp_award(
    state: State<'_, AppState>,
    source: String,
    amount: Option<i64>,
) -> AppResult<XpAwardResponse> {
    let source = match source.as_str() {
        "pomodoro" => xp_service::XpSource::Pomodoro,
        "reminder" => xp_service::XpSource::Reminder,
        "focus_session" => xp_service::XpSource::FocusSession,
        "achievement" => xp_service::XpSource::Achievement,
        "rare_event" => xp_service::XpSource::RareEvent,
        other => return Err(crate::error::AppError::InvalidInput(format!("unknown xp source: {other}"))),
    };
    let result = xp_service::award(&state.db, source, amount, None).await?;

    crate::services::analytics_service::track(
        &state.db,
        "xp_earned",
        serde_json::json!({ "source": source.as_str(), "amount": amount.unwrap_or(source.default_amount()), "total": result.cat_state.xp_total }),
    )
    .await?;

    if result.leveled_up {
        let _ = state.app_handle.emit("level:up", &result.cat_state);
        crate::services::analytics_service::track(
            &state.db,
            "level_up",
            serde_json::json!({ "newLevel": result.cat_state.level, "growthStage": result.cat_state.growth_stage }),
        )
        .await?;
    }
    let _ = state.app_handle.emit("xp:updated", &result.cat_state);

    Ok(XpAwardResponse { cat_state: result.cat_state, leveled_up: result.leveled_up })
}
