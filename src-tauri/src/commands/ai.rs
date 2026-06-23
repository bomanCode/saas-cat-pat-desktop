use crate::error::AppResult;
use crate::integrations::ai_provider;

/// Stores an API key for a hosted AI provider ("openai" | "claude" | "gemini")
/// in the OS keychain (architecture.md §11 — never in SQLite or plaintext).
/// Ollama needs no key since it's local. The raw key only exists in
/// frontend memory for the duration of this one call.
#[tauri::command]
pub fn ai_provider_set_key(provider: String, api_key: String) -> AppResult<()> {
    ai_provider::store_api_key(&provider, &api_key)
}

/// Returns whether a key is configured, WITHOUT returning the key itself —
/// the frontend never needs the raw value back, only "is this set up?"
/// for rendering Settings UI state.
#[tauri::command]
pub fn ai_provider_has_key(provider: String) -> bool {
    ai_provider::has_api_key(&provider)
}

#[tauri::command]
pub fn ai_provider_delete_key(provider: String) -> AppResult<()> {
    ai_provider::delete_api_key(&provider)
}
