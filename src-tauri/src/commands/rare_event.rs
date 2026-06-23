use crate::db::models::RareEventLogRow;
use crate::error::{AppError, AppResult};
use crate::services::rare_event_service;
use crate::AppState;
use base64::Engine;
use tauri::State;

#[tauri::command]
pub async fn rare_event_recent(
    state: State<'_, AppState>,
    limit: i64,
) -> AppResult<Vec<RareEventLogRow>> {
    rare_event_service::recent(&state.db, limit).await
}

/// Saves a screenshot path the frontend captured (via the OS save dialog /
/// canvas export) against a rare-event log row. The backend never captures
/// or transmits the screenshot itself — see architecture.md §11 Privacy.
#[tauri::command]
pub async fn rare_event_save_screenshot(
    state: State<'_, AppState>,
    log_id: i64,
    path: String,
) -> AppResult<()> {
    rare_event_service::record_screenshot(&state.db, log_id, path).await
}

/// F14 shareable screenshots. The frontend captures the Pixi canvas via
/// `canvas.toDataURL("image/png")` and sends the base64 payload (no
/// `data:image/png;base64,` prefix) here. This command is the ONLY place
/// that touches the filesystem for this feature — it writes to the user's
/// Pictures directory under a `Comnyang/` subfolder and never uploads or
/// transmits the image anywhere (architecture.md §11 Privacy: "never
/// auto-shared").
#[tauri::command]
pub async fn rare_event_capture_screenshot(
    state: State<'_, AppState>,
    log_id: i64,
    base64_png: String,
) -> AppResult<String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(base64_png.trim())
        .map_err(|e| AppError::InvalidInput(format!("invalid base64 image data: {e}")))?;

    let pictures_dir =
        dirs::picture_dir().unwrap_or_else(|| dirs::home_dir().unwrap_or_else(|| ".".into()));
    let target_dir = pictures_dir.join("Comnyang");
    std::fs::create_dir_all(&target_dir)?;

    let filename = format!(
        "comnyang-rare-event-{log_id}-{}.png",
        chrono::Utc::now().timestamp()
    );
    let path = target_dir.join(filename);
    std::fs::write(&path, &bytes)?;

    let path_str = path.to_string_lossy().to_string();
    rare_event_service::record_screenshot(&state.db, log_id, path_str.clone()).await?;
    Ok(path_str)
}
