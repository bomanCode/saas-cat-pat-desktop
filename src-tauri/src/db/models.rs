use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CatState {
    pub id: i64,
    pub name: String,
    pub personality: String,
    pub personality_locked_until: Option<i64>,
    pub level: i64,
    pub xp_total: i64,
    pub growth_stage: String,
    pub tier: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct XpEvent {
    pub id: i64,
    pub source: String,
    pub amount: i64,
    pub ref_id: Option<i64>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PomodoroSession {
    pub id: i64,
    pub phase: String,
    pub planned_seconds: i64,
    pub actual_seconds: i64,
    pub status: String,
    pub xp_awarded: i64,
    pub started_at: i64,
    pub ended_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Reminder {
    pub id: i64,
    pub title: String,
    pub body_template: String,
    pub repeat_rule: String,
    pub repeat_payload: Option<String>,
    pub next_fire_at: i64,
    pub is_active: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AiMemoryEntry {
    pub id: i64,
    pub kind: String,
    pub content: String,
    pub source_provider: Option<String>,
    pub pinned: i64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Achievement {
    pub id: String,
    pub title: String,
    pub description: String,
    pub xp_reward: i64,
    pub rule_type: String,
    pub rule_target: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AchievementWithProgress {
    pub achievement: Achievement,
    pub progress: i64,
    pub unlocked: bool,
    pub unlocked_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DailyStory {
    pub id: i64,
    pub story_date: String,
    pub content: String,
    pub story_type: String,
    pub generated_by: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct RareEventLogRow {
    pub id: i64,
    pub event_type: String,
    pub triggered_at: i64,
    pub screenshot_path: Option<String>,
    pub shared: i64,
}
