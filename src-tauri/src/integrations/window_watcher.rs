//! F09 Focus Guardian + F10 AI Presence Detection — shared foreground-window
//! detection layer.
//!
//! See architecture.md §7 for the platform-risk rationale. This module
//! intentionally separates:
//!   1. `WindowWatcher` trait + per-OS impl (gets RAW foreground app info)
//!   2. Pure classification functions (distraction match / AI-tool match)
//!      that operate on `ForegroundApp` and a pattern list — fully
//!      unit-testable without any OS API.
//!
//! Wayland has no standard cross-desktop API for "what window is focused"
//! without compositor-specific portals/extensions, so Linux support is
//! best-effort (X11 via active-win-pos-rs) and falls back to `NullWatcher`
//! — F09/F10 simply report no detections rather than erroring.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ForegroundApp {
    pub process_name: String,
    pub window_title: String,
}

pub trait WindowWatcher: Send + Sync {
    fn foreground_app(&self) -> Option<ForegroundApp>;
}

/// Always returns None. Used on platforms/configs where window watching is
/// unavailable (Wayland without portal support, sandboxed environments,
/// CI/test runs) so the rest of the app degrades gracefully instead of
/// crashing or erroring on every poll.
pub struct NullWatcher;
impl WindowWatcher for NullWatcher {
    fn foreground_app(&self) -> Option<ForegroundApp> {
        None
    }
}

#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
pub struct ActiveWinWatcher;

#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
impl WindowWatcher for ActiveWinWatcher {
    fn foreground_app(&self) -> Option<ForegroundApp> {
        // active-win-pos-rs returns Result<ActiveWindow, ()> with
        // .app_name and .title fields. On Linux this requires X11; under
        // Wayland it will error, which we treat the same as "unavailable".
        match active_win_pos_rs::get_active_window() {
            Ok(w) => Some(ForegroundApp { process_name: w.app_name, window_title: w.title }),
            Err(_) => None,
        }
    }
}

/// Picks the best available watcher for the current platform at runtime.
/// On Linux this still returns `ActiveWinWatcher`, which itself degrades to
/// `None` per-call under Wayland (rather than us trying to detect the
/// session type up front, which is itself unreliable across distros).
pub fn default_watcher() -> Box<dyn WindowWatcher> {
    #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
    {
        Box::new(ActiveWinWatcher)
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Box::new(NullWatcher)
    }
}

// ---------------------------------------------------------------------------
// F09 — Focus Guardian classification (pure, unit-tested)
// ---------------------------------------------------------------------------

/// Default distraction patterns — overridden by `app_settings.distraction_patterns`
/// (schema.sql), matched case-insensitively against title OR process name.
pub fn is_distraction(app: &ForegroundApp, patterns: &[String]) -> bool {
    let haystack = format!("{} {}", app.process_name, app.window_title).to_lowercase();
    patterns.iter().any(|p| haystack.contains(&p.to_lowercase()))
}

// ---------------------------------------------------------------------------
// F10 — AI Presence classification (pure, unit-tested)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AiToolKind {
    ChatGpt,
    Claude,
    Gemini,
}

const AI_TOOL_PATTERNS: &[(AiToolKind, &[&str])] = &[
    (AiToolKind::ChatGpt, &["chatgpt", "chat.openai.com", "openai"]),
    (AiToolKind::Claude, &["claude.ai", "anthropic"]),
    (AiToolKind::Gemini, &["gemini.google.com", "bard.google.com"]),
];

/// Returns the detected AI tool, if any, with a naive confidence score.
/// Confidence is higher when the match comes from the window title (more
/// specific) than just the process name (e.g. a generic browser process).
pub fn detect_ai_tool(app: &ForegroundApp) -> Option<(AiToolKind, f32)> {
    let title = app.window_title.to_lowercase();
    let process = app.process_name.to_lowercase();
    for (kind, patterns) in AI_TOOL_PATTERNS {
        for p in *patterns {
            if title.contains(p) {
                return Some((*kind, 0.95));
            }
            if process.contains(p) {
                return Some((*kind, 0.75));
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn app(process: &str, title: &str) -> ForegroundApp {
        ForegroundApp { process_name: process.into(), window_title: title.into() }
    }

    #[test]
    fn detects_youtube_distraction_by_title() {
        let patterns = vec!["youtube.com".to_string(), "tiktok.com".to_string()];
        assert!(is_distraction(&app("chrome.exe", "Cat videos - YouTube.com"), &patterns));
    }

    #[test]
    fn ignores_non_matching_app() {
        let patterns = vec!["youtube.com".to_string()];
        assert!(!is_distraction(&app("code.exe", "main.rs - VS Code"), &patterns));
    }

    #[test]
    fn detects_chatgpt_in_browser_tab_title() {
        let detected = detect_ai_tool(&app("chrome.exe", "ChatGPT - New chat"));
        assert_eq!(detected.unwrap().0, AiToolKind::ChatGpt);
    }

    #[test]
    fn detects_claude_with_high_confidence_from_title() {
        let (kind, confidence) = detect_ai_tool(&app("firefox.exe", "claude.ai - Comnyang planning")).unwrap();
        assert_eq!(kind, AiToolKind::Claude);
        assert!(confidence >= 0.9);
    }

    #[test]
    fn returns_none_for_unrelated_window() {
        assert!(detect_ai_tool(&app("spotify.exe", "Lo-fi beats to code to")).is_none());
    }
}
