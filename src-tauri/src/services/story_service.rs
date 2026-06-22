//! F12 — Daily Story Engine.
//!
//! Works fully offline (spec FR-12 AC) via local template substitution
//! against the day's activity summary. If an AI provider is configured
//! (Section 9 of architecture.md, `AiProvider` trait), `generate_for_today`
//! can optionally hand the template "draft" to the provider to be reworded
//! — but the offline template is ALWAYS produced first, so the feature
//! never blocks on network access. Idempotency is enforced by the UNIQUE
//! constraint on `daily_stories.story_date`.

use crate::db::models::DailyStory;
use crate::error::AppResult;
use chrono::Local;
use rand::seq::SliceRandom;
use rand::thread_rng;
use sqlx::SqlitePool;

pub struct DayActivitySummary {
    pub xp_earned: i64,
    pub pomodoros_completed: i64,
    pub dominant_mood: String,
    pub rare_event: Option<String>,
}

async fn summarize_today(pool: &SqlitePool) -> AppResult<DayActivitySummary> {
    let start_of_day = Local::now().date_naive().and_hms_opt(0, 0, 0).unwrap();
    let start_ts = start_of_day.and_utc().timestamp();

    let xp_earned: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount),0) FROM xp_events WHERE created_at >= ?",
    )
    .bind(start_ts)
    .fetch_one(pool)
    .await?;

    let pomodoros_completed: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pomodoro_sessions WHERE status='completed' AND started_at >= ?",
    )
    .bind(start_ts)
    .fetch_one(pool)
    .await?;

    let dominant_mood: Option<String> = sqlx::query_scalar(
        "SELECT mood FROM mood_log WHERE recorded_at >= ? GROUP BY mood ORDER BY COUNT(*) DESC LIMIT 1",
    )
    .bind(start_ts)
    .fetch_optional(pool)
    .await?;

    let rare_event: Option<String> = sqlx::query_scalar(
        "SELECT event_type FROM rare_event_log WHERE triggered_at >= ? ORDER BY triggered_at DESC LIMIT 1",
    )
    .bind(start_ts)
    .fetch_optional(pool)
    .await?;

    Ok(DayActivitySummary {
        xp_earned,
        pomodoros_completed,
        dominant_mood: dominant_mood.unwrap_or_else(|| "happy".into()),
        rare_event,
    })
}

const DREAM_TEMPLATES: &[&str] = &[
    "I dreamed I was chasing a {xp}-point laser dot through an endless server room.",
    "Had a dream I turned into a {mood} cloud and floated above your keyboard all night.",
];
const ADVENTURE_TEMPLATES: &[&str] = &[
    "Today I guarded {pomodoros} focus sessions like a tiny furry sentinel. Mission: success.",
    "I explored the Land Behind The Monitor today. Found {xp} XP worth of dust bunnies.",
];
const FUNNY_TEMPLATES: &[&str] = &[
    "Pretty sure I knocked something off a shelf today. Worth it though, felt {mood} about it.",
    "I tried to help you focus by sitting directly on the keyboard. {pomodoros} times. You're welcome.",
];

fn render(template: &str, s: &DayActivitySummary) -> String {
    template
        .replace("{xp}", &s.xp_earned.to_string())
        .replace("{pomodoros}", &s.pomodoros_completed.to_string())
        .replace("{mood}", &s.dominant_mood)
}

fn pick_story(s: &DayActivitySummary) -> (&'static str, &'static str) {
    let mut rng = thread_rng();
    if s.rare_event.is_some() || s.pomodoros_completed >= 4 {
        ("adventure", ADVENTURE_TEMPLATES.choose(&mut rng).unwrap())
    } else if s.dominant_mood == "sleepy" {
        ("dream", DREAM_TEMPLATES.choose(&mut rng).unwrap())
    } else {
        ("funny", FUNNY_TEMPLATES.choose(&mut rng).unwrap())
    }
}

pub async fn get_or_generate_today(pool: &SqlitePool) -> AppResult<DailyStory> {
    let today = Local::now().format("%Y-%m-%d").to_string();

    if let Some(existing) = sqlx::query_as::<_, DailyStory>(
        "SELECT * FROM daily_stories WHERE story_date = ?",
    )
    .bind(&today)
    .fetch_optional(pool)
    .await?
    {
        return Ok(existing);
    }

    let summary = summarize_today(pool).await?;
    let (story_type, template) = pick_story(&summary);
    let content = render(template, &summary);

    sqlx::query(
        "INSERT INTO daily_stories (story_date, content, story_type, generated_by) VALUES (?, ?, ?, 'template')
         ON CONFLICT(story_date) DO NOTHING",
    )
    .bind(&today)
    .bind(&content)
    .bind(story_type)
    .execute(pool)
    .await?;

    sqlx::query_as("SELECT * FROM daily_stories WHERE story_date = ?")
        .bind(&today)
        .fetch_one(pool)
        .await
        .map_err(Into::into)
}

/// Pro-only manual regenerate — explicitly bypasses the per-day cache.
pub async fn regenerate_today(pool: &SqlitePool) -> AppResult<DailyStory> {
    let today = Local::now().format("%Y-%m-%d").to_string();
    let summary = summarize_today(pool).await?;
    let (story_type, template) = pick_story(&summary);
    let content = render(template, &summary);

    sqlx::query(
        "UPDATE daily_stories SET content = ?, story_type = ?, created_at = unixepoch() WHERE story_date = ?",
    )
    .bind(&content)
    .bind(story_type)
    .bind(&today)
    .execute(pool)
    .await?;

    sqlx::query_as("SELECT * FROM daily_stories WHERE story_date = ?")
        .bind(&today)
        .fetch_one(pool)
        .await
        .map_err(Into::into)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn generating_twice_in_one_day_is_idempotent() {
        let pool = crate::db::init_test_pool().await;
        let first = get_or_generate_today(&pool).await.unwrap();
        let second = get_or_generate_today(&pool).await.unwrap();
        assert_eq!(first.id, second.id);
        assert_eq!(first.content, second.content);
    }

    #[tokio::test]
    async fn high_pomodoro_day_picks_adventure_story() {
        let pool = crate::db::init_test_pool().await;
        use crate::services::pomodoro_service::{self, Phase};
        for _ in 0..4 {
            let s = pomodoro_service::start(&pool, Phase::Focus, 60).await.unwrap();
            pomodoro_service::complete(&pool, s.id, 60).await.unwrap();
        }
        let story = get_or_generate_today(&pool).await.unwrap();
        assert_eq!(story.story_type, "adventure");
    }
}
