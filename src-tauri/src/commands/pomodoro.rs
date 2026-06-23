use crate::db::models::PomodoroSession;
use crate::error::AppResult;
use crate::services::pomodoro_service::{self, Phase};
use crate::AppState;
use serde::Serialize;
use tauri::{Emitter, State};

#[tauri::command]
pub async fn pomodoro_start(
    state: State<'_, AppState>,
    phase: String,
    planned_seconds: i64,
) -> AppResult<PomodoroSession> {
    let phase = match phase.as_str() {
        "focus" => Phase::Focus,
        "break" => Phase::Break,
        other => return Err(crate::error::AppError::InvalidInput(format!("unknown phase: {other}"))),
    };
    let session = pomodoro_service::start(&state.db, phase, planned_seconds).await?;
    crate::services::analytics_service::track(
        &state.db, "pomodoro_start", serde_json::json!({ "phase": session.phase }),
    ).await?;
    if matches!(phase, Phase::Focus) {
        crate::services::analytics_service::track(
            &state.db, "focus_start", serde_json::json!({ "plannedSeconds": planned_seconds }),
        ).await?;
    }
    Ok(session)
}

#[tauri::command]
pub async fn pomodoro_pause(
    state: State<'_, AppState>,
    session_id: i64,
) -> AppResult<PomodoroSession> {
    pomodoro_service::pause(&state.db, session_id).await
}

#[tauri::command]
pub async fn pomodoro_resume(
    state: State<'_, AppState>,
    session_id: i64,
) -> AppResult<PomodoroSession> {
    pomodoro_service::resume(&state.db, session_id).await
}

#[derive(Serialize)]
pub struct CompleteResponse {
    pub session: PomodoroSession,
    pub xp_awarded: i64,
}

#[tauri::command]
pub async fn pomodoro_complete(
    state: State<'_, AppState>,
    session_id: i64,
    actual_seconds: i64,
) -> AppResult<CompleteResponse> {
    let result = pomodoro_service::complete(&state.db, session_id, actual_seconds).await?;

    crate::services::analytics_service::track(
        &state.db,
        "pomodoro_complete",
        serde_json::json!({ "phase": result.session.phase, "xpAwarded": result.xp_awarded }),
    ).await?;
    if result.session.phase == "focus" {
        crate::services::analytics_service::track(
            &state.db,
            "focus_complete",
            serde_json::json!({ "actualSeconds": result.session.actual_seconds, "xpAwarded": result.xp_awarded }),
        ).await?;
    }

    // Achievements may unlock off the back of this completion (e.g. Pomodoro Master).
    let unlocked = crate::services::achievement_service::evaluate_all(&state.db).await?;
    for a in &unlocked {
        let _ = state.app_handle.emit("achievement:unlocked", a);
        crate::services::analytics_service::track(
            &state.db, "achievement_unlocked", serde_json::json!({ "id": a.id, "xpAwarded": a.xp_reward }),
        ).await?;
    }

    let _ = state.app_handle.emit("pomodoro:completed", &result.session);
    Ok(CompleteResponse { session: result.session, xp_awarded: result.xp_awarded })
}

#[tauri::command]
pub async fn pomodoro_history(
    state: State<'_, AppState>,
    from: Option<i64>,
    to: Option<i64>,
) -> AppResult<Vec<PomodoroSession>> {
    pomodoro_service::history(&state.db, from, to).await
}
