pub mod commands;
pub mod db;
pub mod error;
pub mod integrations;
pub mod services;

use chrono::Timelike;
use sqlx::SqlitePool;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Listener, Manager};

/// Shared app state, injected into every command via `tauri::State<AppState>`.
/// `app_handle` lets commands emit events to all windows (architecture.md §5:
/// "Rust side remains source of truth, multiple windows stay in sync").
pub struct AppState {
    pub db: SqlitePool,
    pub app_handle: AppHandle,
}

pub fn run() {
    tracing_subscriber::fmt().with_env_filter("comnyang=info").init();

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = bootstrap(app_handle).await {
                    tracing::error!("bootstrap failed: {e}");
                }
            });
            setup_tray(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::cat::cat_get_state,
            commands::cat::cat_set_personality,
            commands::cat::cat_rename,
            commands::cat::xp_award,
            commands::ai::ai_provider_set_key,
            commands::ai::ai_provider_has_key,
            commands::ai::ai_provider_delete_key,
            commands::pomodoro::pomodoro_start,
            commands::pomodoro::pomodoro_pause,
            commands::pomodoro::pomodoro_resume,
            commands::pomodoro::pomodoro_complete,
            commands::pomodoro::pomodoro_history,
            commands::reminder::reminder_create,
            commands::reminder::reminder_list,
            commands::reminder::reminder_update,
            commands::reminder::reminder_delete,
            commands::memory::memory_save,
            commands::memory::memory_search,
            commands::memory::memory_delete,
            commands::memory::memory_list_tags,
            commands::achievement::achievement_list,
            commands::story::story_get_today,
            commands::story::story_regenerate,
            commands::rare_event::rare_event_recent,
            commands::rare_event::rare_event_save_screenshot,
            commands::rare_event::rare_event_capture_screenshot,
            commands::settings::settings_get,
            commands::settings::settings_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running comnyang");
}

/// Async setup that can't run directly in `.setup()` (which is sync):
/// opens the DB pool, runs migrations, reconciles stale state, manages
/// `AppState`, then kicks off all background loops.
async fn bootstrap(app: AppHandle) -> anyhow::Result<()> {
    let path = db::db_path();
    let pool = db::init_pool(&path).await?;

    pomodoro_reconcile_on_boot(&pool).await;

    let state = AppState { db: pool.clone(), app_handle: app.clone() };
    app.manage(state);

    services::analytics_service::track(&pool, "app_open", serde_json::json!({})).await.ok();

    spawn_reminder_loop(app.clone(), pool.clone());
    spawn_mood_loop(app.clone(), pool.clone());
    spawn_focus_guardian_loop(app.clone(), pool.clone());
    spawn_rare_event_loop(app.clone(), pool.clone());
    spawn_analytics_flush_loop(pool.clone());

    Ok(())
}

async fn pomodoro_reconcile_on_boot(pool: &SqlitePool) {
    match services::pomodoro_service::reconcile_stale_sessions(pool).await {
        Ok(n) if n > 0 => tracing::info!("reconciled {n} stale pomodoro session(s) on boot"),
        Ok(_) => {}
        Err(e) => tracing::warn!("failed to reconcile stale sessions: {e}"),
    }
}

fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem};
    use tauri::tray::TrayIconBuilder;

    let open_hub = MenuItem::with_id(app, "open_hub", "Open Hub", true, None::<&str>)?;
    let start_focus = MenuItem::with_id(app, "start_focus", "Start Focus", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&start_focus, &open_hub, &quit])?;

    let mut tray = TrayIconBuilder::new()
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "quit" => app.exit(0),
            "open_hub" => {
                if let Some(hub) = app.get_webview_window("hub") {
                    let _ = hub.show();
                    let _ = hub.set_focus();
                }
                let _ = app.emit("tray:open_hub", ());
            }
            "start_focus" => {
                let _ = app.emit("tray:start_focus", ());
            }
            _ => {}
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Background loops. Each is intentionally a separate, single-purpose tokio
// task (not one giant scheduler) so a panic/slow query in one (e.g. the
// window watcher hanging on a permission prompt) can't stall the others.
// ---------------------------------------------------------------------------

fn spawn_reminder_loop(app: AppHandle, pool: SqlitePool) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(5)).await;
            let cat_name: String = sqlx::query_scalar("SELECT name FROM cat_state WHERE id = 1")
                .fetch_one(&pool)
                .await
                .unwrap_or_else(|_| "Comnyang".to_string());

            match services::reminder_service::fire_due(&pool, &cat_name).await {
                Ok(fired) => {
                    for r in fired {
                        integrations::notifier::notify(&app, &r.title, &r.body_template);
                        let _ = app.emit("reminder:due", &r);
                    }
                }
                Err(e) => tracing::warn!("reminder poll failed: {e}"),
            }
        }
    });
}

fn spawn_mood_loop(app: AppHandle, pool: SqlitePool) {
    use services::mood_service::{compute_mood, log_mood, MoodSignals};
    let last_interaction = Arc::new(std::sync::atomic::AtomicI64::new(
        chrono::Utc::now().timestamp(),
    ));
    let interactions_window: Arc<std::sync::Mutex<Vec<i64>>> =
        Arc::new(std::sync::Mutex::new(Vec::new()));

    // Listen for interaction events from the frontend (drag/click/pat) to
    // feed the mood signal — see pet_interaction analytics event.
    {
        let interactions_window = interactions_window.clone();
        let last_interaction = last_interaction.clone();
        app.listen("pet:interaction", move |_event| {
            let now = chrono::Utc::now().timestamp();
            last_interaction.store(now, std::sync::atomic::Ordering::Relaxed);
            if let Ok(mut w) = interactions_window.lock() {
                w.push(now);
                w.retain(|t| now - t < 3600);
            }
        });
    }

    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(15)).await;
            let now = chrono::Utc::now();
            let idle_seconds = now.timestamp()
                - last_interaction.load(std::sync::atomic::Ordering::Relaxed);
            let interactions_last_hour = interactions_window
                .lock()
                .map(|w| w.len() as u32)
                .unwrap_or(0);

            let focus_active: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM pomodoro_sessions WHERE phase='focus' AND status='running')",
            )
            .fetch_one(&pool)
            .await
            .unwrap_or(false);

            let signals = MoodSignals {
                idle_seconds,
                focus_session_active: focus_active,
                hour_of_day: chrono::Local::now().hour() as u8,
                interactions_last_hour,
                consecutive_work_hours: 0.0,
            };
            let mood = compute_mood(signals);
            let _ = log_mood(&pool, mood).await;
            let _ = app.emit("mood:changed", mood.as_str());
        }
    });
}

fn spawn_focus_guardian_loop(app: AppHandle, pool: SqlitePool) {
    use integrations::window_watcher::{default_watcher, detect_ai_tool, is_distraction};

    tauri::async_runtime::spawn(async move {
        let watcher = default_watcher();
        let mut last_nudge_at = 0i64;
        loop {
            tokio::time::sleep(Duration::from_secs(3)).await;

            let focus_active: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM pomodoro_sessions WHERE phase='focus' AND status='running')",
            )
            .fetch_one(&pool)
            .await
            .unwrap_or(false);

            let Some(fg) = watcher.foreground_app() else { continue };

            // F10 — AI Presence Detection runs regardless of focus mode.
            if let Some((kind, confidence)) = detect_ai_tool(&fg) {
                let _ = app.emit("ai:presence_detected", serde_json::json!({ "provider": kind, "confidence": confidence }));
                let _ = services::analytics_service::track(
                    &pool, "ai_detected", serde_json::json!({ "provider": kind, "confidence": confidence }),
                ).await;
            }

            // F09 — Focus Guardian only nudges during an active focus session,
            // and never more than once every 60s (non-blocking, friendly).
            if focus_active {
                let patterns: Vec<String> = sqlx::query_scalar("SELECT value FROM app_settings WHERE key='distraction_patterns'")
                    .fetch_optional(&pool)
                    .await
                    .ok()
                    .flatten()
                    .and_then(|v: String| serde_json::from_str(&v).ok())
                    .unwrap_or_default();

                let now = chrono::Utc::now().timestamp();
                if is_distraction(&fg, &patterns) && now - last_nudge_at > 60 {
                    last_nudge_at = now;
                    let _ = app.emit("focus:distraction_detected", &fg);
                }
            }
        }
    });
}

fn spawn_rare_event_loop(app: AppHandle, pool: SqlitePool) {
    tauri::async_runtime::spawn(async move {
        loop {
            // Default cadence: hourly (spec FR-14). Shortened in dev builds
            // via COMNYANG_RARE_EVENT_INTERVAL_SECS for manual QA.
            let interval = std::env::var("COMNYANG_RARE_EVENT_INTERVAL_SECS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(3600);
            tokio::time::sleep(Duration::from_secs(interval)).await;

            match services::rare_event_service::maybe_trigger(&pool).await {
                Ok(Some(event)) => {
                    let _ = app.emit("rare_event:triggered", event);
                    let _ = services::analytics_service::track(
                        &pool, "rare_event_triggered", serde_json::json!({ "eventType": event }),
                    ).await;
                }
                Ok(None) => {}
                Err(e) => tracing::warn!("rare event roll failed: {e}"),
            }
        }
    });
}

fn spawn_analytics_flush_loop(pool: SqlitePool) {
    tauri::async_runtime::spawn(async move {
        let client = reqwest::Client::new();
        loop {
            tokio::time::sleep(Duration::from_secs(30)).await;
            let api_key = std::env::var("POSTHOG_API_KEY").unwrap_or_default();
            if api_key.is_empty() {
                continue; // analytics opt-in / not configured — never block the app
            }
            let host = std::env::var("POSTHOG_HOST").unwrap_or_else(|_| "https://app.posthog.com".to_string());

            match services::analytics_service::unflushed_batch(&pool, 100).await {
                Ok(batch) if !batch.is_empty() => {
                    let ids: Vec<i64> = batch.iter().map(|e| e.id).collect();
                    if services::analytics_service::flush_to_posthog(
                        &client, &api_key, &host, &batch,
                    )
                    .await
                    .is_ok()
                    {
                        let _ = services::analytics_service::mark_flushed(&pool, &ids).await;
                    }
                }
                Ok(_) => {}
                Err(e) => tracing::warn!("analytics batch fetch failed: {e}"),
            }
        }
    });
}


