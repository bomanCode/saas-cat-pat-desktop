//! Thin wrapper over `tauri-plugin-notification` so services never depend
//! on `tauri::AppHandle` directly (keeps services unit-testable per
//! architecture.md §6). Commands/background loops call this; services
//! return data, this module is the only place that actually fires a native
//! OS notification.

use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

pub fn notify(app: &AppHandle, title: &str, body: &str) {
    if let Err(e) = app.notification().builder().title(title).body(body).show() {
        tracing::warn!("failed to show notification: {e}");
    }
}
