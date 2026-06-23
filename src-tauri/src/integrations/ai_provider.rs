//! AI Layer abstraction (architecture.md §9). Used by `story_service` for
//! optional AI-enhanced Daily Stories and by F11's "save AI response"
//! command metadata (`source_provider`). NOT used by F10 AI Presence
//! Detection, which detects the user's own use of these tools via
//! `window_watcher`, rather than calling out to them.
//!
//! Ollama is the default (architecture.md §9): no API key, runs locally,
//! so every feature gated behind "an AI provider" works out of the box on
//! Free tier as long as the user has Ollama running — OpenAI/Claude/Gemini
//! are opt-in upgrades requiring a user-supplied key, stored via the
//! `keyring` crate (OS keychain: Windows Credential Manager / macOS
//! Keychain / Linux Secret Service), never in SQLite or plaintext config
//! (NFR-03).

use crate::error::{AppError, AppResult};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

const KEYRING_SERVICE: &str = "com.comnyang.app";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiContext {
    pub system_prompt: Option<String>,
    pub max_tokens: u32,
}

impl Default for AiContext {
    fn default() -> Self {
        Self {
            system_prompt: None,
            max_tokens: 512,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiResponse {
    pub text: String,
    pub provider: &'static str,
}

#[async_trait]
pub trait AiProvider: Send + Sync {
    async fn complete(&self, prompt: &str, ctx: &AiContext) -> AppResult<AiResponse>;
    fn name(&self) -> &'static str;
}

// ---------------------------------------------------------------------------
// Key storage — OS keychain via `keyring`. Stored under one entry per
// provider name so switching providers never overwrites another's key.
// ---------------------------------------------------------------------------

pub fn store_api_key(provider: &str, api_key: &str) -> AppResult<()> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, provider)
        .map_err(|e| AppError::Internal(format!("keyring entry failed: {e}")))?;
    entry
        .set_password(api_key)
        .map_err(|e| AppError::Internal(format!("keyring write failed: {e}")))?;
    Ok(())
}

pub fn get_api_key(provider: &str) -> Option<String> {
    keyring::Entry::new(KEYRING_SERVICE, provider)
        .ok()?
        .get_password()
        .ok()
}

pub fn delete_api_key(provider: &str) -> AppResult<()> {
    if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, provider) {
        // A missing entry is not an error — "delete" is idempotent.
        let _ = entry.delete_credential();
    }
    Ok(())
}

pub fn has_api_key(provider: &str) -> bool {
    get_api_key(provider).is_some_and(|k| !k.trim().is_empty())
}

// ---------------------------------------------------------------------------
// Ollama — local, no API key, default Free-tier provider.
// ---------------------------------------------------------------------------

pub struct OllamaProvider {
    pub base_url: String,
    pub model: String,
    client: reqwest::Client,
}

impl OllamaProvider {
    pub fn new(base_url: impl Into<String>, model: impl Into<String>) -> Self {
        Self {
            base_url: base_url.into(),
            model: model.into(),
            client: reqwest::Client::new(),
        }
    }
}

#[async_trait]
impl AiProvider for OllamaProvider {
    async fn complete(&self, prompt: &str, ctx: &AiContext) -> AppResult<AiResponse> {
        let body = serde_json::json!({
            "model": self.model,
            "prompt": match &ctx.system_prompt {
                Some(sys) => format!("{sys}\n\n{prompt}"),
                None => prompt.to_string(),
            },
            "stream": false,
        });
        let resp = self
            .client
            .post(format!("{}/api/generate", self.base_url))
            .json(&body)
            .send()
            .await
            .map_err(|e| {
                AppError::AiProvider(format!(
                    "Couldn't reach Ollama at {} — is it running? ({e})",
                    self.base_url
                ))
            })?;
        if !resp.status().is_success() {
            return Err(AppError::AiProvider(format!(
                "Ollama returned HTTP {}",
                resp.status()
            )));
        }
        let json: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| AppError::AiProvider(format!("ollama response parse failed: {e}")))?;
        let text = json
            .get("response")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        Ok(AiResponse {
            text,
            provider: "ollama",
        })
    }
    fn name(&self) -> &'static str {
        "ollama"
    }
}

// ---------------------------------------------------------------------------
// OpenAI — Chat Completions API.
// ---------------------------------------------------------------------------

pub struct OpenAiProvider {
    pub model: String,
    api_key: String,
    client: reqwest::Client,
}

impl OpenAiProvider {
    pub fn new(api_key: impl Into<String>, model: impl Into<String>) -> Self {
        Self {
            api_key: api_key.into(),
            model: model.into(),
            client: reqwest::Client::new(),
        }
    }
}

#[async_trait]
impl AiProvider for OpenAiProvider {
    async fn complete(&self, prompt: &str, ctx: &AiContext) -> AppResult<AiResponse> {
        let mut messages = Vec::new();
        if let Some(sys) = &ctx.system_prompt {
            messages.push(serde_json::json!({ "role": "system", "content": sys }));
        }
        messages.push(serde_json::json!({ "role": "user", "content": prompt }));

        let resp = self
            .client
            .post("https://api.openai.com/v1/chat/completions")
            .bearer_auth(&self.api_key)
            .json(&serde_json::json!({
                "model": self.model,
                "messages": messages,
                "max_tokens": ctx.max_tokens,
            }))
            .send()
            .await
            .map_err(|e| AppError::AiProvider(format!("OpenAI request failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::AiProvider(format!(
                "OpenAI returned HTTP {status}: {body}"
            )));
        }

        let json: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| AppError::AiProvider(format!("OpenAI response parse failed: {e}")))?;
        let text = json["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string();
        Ok(AiResponse {
            text,
            provider: "openai",
        })
    }
    fn name(&self) -> &'static str {
        "openai"
    }
}

// ---------------------------------------------------------------------------
// Anthropic Claude — Messages API.
// ---------------------------------------------------------------------------

pub struct ClaudeProvider {
    pub model: String,
    api_key: String,
    client: reqwest::Client,
}

impl ClaudeProvider {
    pub fn new(api_key: impl Into<String>, model: impl Into<String>) -> Self {
        Self {
            api_key: api_key.into(),
            model: model.into(),
            client: reqwest::Client::new(),
        }
    }
}

#[async_trait]
impl AiProvider for ClaudeProvider {
    async fn complete(&self, prompt: &str, ctx: &AiContext) -> AppResult<AiResponse> {
        let mut body = serde_json::json!({
            "model": self.model,
            "max_tokens": ctx.max_tokens,
            "messages": [{ "role": "user", "content": prompt }],
        });
        if let Some(sys) = &ctx.system_prompt {
            body["system"] = serde_json::Value::String(sys.clone());
        }

        let resp = self
            .client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::AiProvider(format!("Claude request failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::AiProvider(format!(
                "Claude API returned HTTP {status}: {body}"
            )));
        }

        let json: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| AppError::AiProvider(format!("Claude response parse failed: {e}")))?;
        let text = json["content"][0]["text"]
            .as_str()
            .unwrap_or("")
            .to_string();
        Ok(AiResponse {
            text,
            provider: "claude",
        })
    }
    fn name(&self) -> &'static str {
        "claude"
    }
}

// ---------------------------------------------------------------------------
// Google Gemini — generateContent API.
// ---------------------------------------------------------------------------

pub struct GeminiProvider {
    pub model: String,
    api_key: String,
    client: reqwest::Client,
}

impl GeminiProvider {
    pub fn new(api_key: impl Into<String>, model: impl Into<String>) -> Self {
        Self {
            api_key: api_key.into(),
            model: model.into(),
            client: reqwest::Client::new(),
        }
    }
}

#[async_trait]
impl AiProvider for GeminiProvider {
    async fn complete(&self, prompt: &str, ctx: &AiContext) -> AppResult<AiResponse> {
        let full_prompt = match &ctx.system_prompt {
            Some(sys) => format!("{sys}\n\n{prompt}"),
            None => prompt.to_string(),
        };
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
            self.model, self.api_key
        );

        let resp = self
            .client
            .post(&url)
            .json(&serde_json::json!({
                "contents": [{ "parts": [{ "text": full_prompt }] }],
                "generationConfig": { "maxOutputTokens": ctx.max_tokens },
            }))
            .send()
            .await
            .map_err(|e| AppError::AiProvider(format!("Gemini request failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::AiProvider(format!(
                "Gemini API returned HTTP {status}: {body}"
            )));
        }

        let json: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| AppError::AiProvider(format!("Gemini response parse failed: {e}")))?;
        let text = json["candidates"][0]["content"]["parts"][0]["text"]
            .as_str()
            .unwrap_or("")
            .to_string();
        Ok(AiResponse {
            text,
            provider: "gemini",
        })
    }
    fn name(&self) -> &'static str {
        "gemini"
    }
}

// ---------------------------------------------------------------------------
// Resolution — picks a real provider from app_settings + keyring, or a
// clear "not configured" error rather than crashing/panicking.
// ---------------------------------------------------------------------------

pub struct UnconfiguredProvider {
    pub provider_name: String,
}

#[async_trait]
impl AiProvider for UnconfiguredProvider {
    async fn complete(&self, _prompt: &str, _ctx: &AiContext) -> AppResult<AiResponse> {
        Err(AppError::AiProvider(format!(
            "{} is not configured — add an API key in Settings",
            self.provider_name
        )))
    }
    fn name(&self) -> &'static str {
        "unconfigured"
    }
}

/// `name` is one of "ollama" | "openai" | "claude" | "gemini". Reads the
/// API key from the OS keychain for hosted providers — never from a
/// command argument, so the frontend never holds the raw key in memory
/// longer than the one-time `ai_provider_set_key` call (commands/ai.rs).
pub fn resolve_provider(name: &str) -> Box<dyn AiProvider> {
    match name {
        "ollama" => Box::new(OllamaProvider::new("http://localhost:11434", "llama3.1")),
        "openai" => match get_api_key("openai") {
            Some(key) => Box::new(OpenAiProvider::new(key, "gpt-4o-mini")),
            None => Box::new(UnconfiguredProvider {
                provider_name: "OpenAI".into(),
            }),
        },
        "claude" => match get_api_key("claude") {
            Some(key) => Box::new(ClaudeProvider::new(key, "claude-sonnet-4-6")),
            None => Box::new(UnconfiguredProvider {
                provider_name: "Claude".into(),
            }),
        },
        "gemini" => match get_api_key("gemini") {
            Some(key) => Box::new(GeminiProvider::new(key, "gemini-2.0-flash")),
            None => Box::new(UnconfiguredProvider {
                provider_name: "Gemini".into(),
            }),
        },
        other => Box::new(UnconfiguredProvider {
            provider_name: other.to_string(),
        }),
    }
}
