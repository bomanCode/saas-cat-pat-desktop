//! F13 — Achievement System.
//!
//! Rule types are evaluated against the database directly (each rule is a
//! small, self-contained COUNT query) rather than recomputed from in-memory
//! event streams, so evaluation is correct even if it's only run once a
//! session (e.g. right after each XP-earning action) rather than
//! continuously. `achievement_unlocks` has `achievement_id` as PRIMARY KEY,
//! which makes the unlock INSERT naturally idempotent at the DB level —
//! belt-and-suspenders against the "exactly once" AC in FR-13.

use crate::db::models::{Achievement, AchievementWithProgress};
use crate::error::AppResult;
use crate::services::xp_service::{self, XpSource};
use sqlx::SqlitePool;

async fn progress_for_rule(pool: &SqlitePool, rule_type: &str) -> AppResult<i64> {
    let count: i64 = match rule_type {
        "focus_sessions_completed" => {
            sqlx::query_scalar(
                "SELECT COUNT(*) FROM pomodoro_sessions WHERE phase='focus' AND status='completed'",
            )
            .fetch_one(pool)
            .await?
        }
        "pomodoro_completed" => {
            sqlx::query_scalar("SELECT COUNT(*) FROM pomodoro_sessions WHERE status='completed'")
                .fetch_one(pool)
                .await?
        }
        "memory_entries_saved" => {
            sqlx::query_scalar("SELECT COUNT(*) FROM ai_memory_entries")
                .fetch_one(pool)
                .await?
        }
        "weekend_sessions" => {
            // sqlite strftime('%w', ...) -> 0=Sunday..6=Saturday
            sqlx::query_scalar(
                "SELECT COUNT(*) FROM pomodoro_sessions
                 WHERE phase='focus' AND status='completed'
                   AND strftime('%w', datetime(started_at,'unixepoch')) IN ('0','6')",
            )
            .fetch_one(pool)
            .await?
        }
        "late_night_sessions" => {
            sqlx::query_scalar(
                "SELECT COUNT(*) FROM pomodoro_sessions
                 WHERE phase='focus' AND status='completed'
                   AND CAST(strftime('%H', datetime(started_at,'unixepoch')) AS INTEGER) >= 23",
            )
            .fetch_one(pool)
            .await?
        }
        _ => 0,
    };
    Ok(count)
}

pub async fn list_with_progress(pool: &SqlitePool) -> AppResult<Vec<AchievementWithProgress>> {
    let achievements: Vec<Achievement> = sqlx::query_as("SELECT * FROM achievements")
        .fetch_all(pool)
        .await?;
    let mut out = Vec::with_capacity(achievements.len());
    for a in achievements {
        let progress = progress_for_rule(pool, &a.rule_type).await?;
        let unlocked_at: Option<i64> = sqlx::query_scalar(
            "SELECT unlocked_at FROM achievement_unlocks WHERE achievement_id = ?",
        )
        .bind(&a.id)
        .fetch_optional(pool)
        .await?;
        out.push(AchievementWithProgress {
            unlocked: unlocked_at.is_some(),
            unlocked_at,
            progress: progress.min(a.rule_target),
            achievement: a,
        });
    }
    Ok(out)
}

/// Call after any event that could complete an achievement (pomodoro
/// complete, memory save, etc). Cheap enough to call liberally — each rule
/// is an indexed COUNT query.
pub async fn evaluate_all(pool: &SqlitePool) -> AppResult<Vec<Achievement>> {
    let achievements: Vec<Achievement> = sqlx::query_as("SELECT * FROM achievements")
        .fetch_all(pool)
        .await?;
    let mut newly_unlocked = Vec::new();

    for a in achievements {
        let already: Option<i64> =
            sqlx::query_scalar("SELECT 1 FROM achievement_unlocks WHERE achievement_id = ?")
                .bind(&a.id)
                .fetch_optional(pool)
                .await?;
        if already.is_some() {
            continue;
        }
        let progress = progress_for_rule(pool, &a.rule_type).await?;
        if progress >= a.rule_target {
            let inserted = sqlx::query(
                "INSERT INTO achievement_unlocks (achievement_id) VALUES (?) ON CONFLICT(achievement_id) DO NOTHING",
            )
            .bind(&a.id)
            .execute(pool)
            .await?;
            if inserted.rows_affected() > 0 {
                xp_service::award(pool, XpSource::Achievement, Some(a.xp_reward), None).await?;
                newly_unlocked.push(a);
            }
        }
    }
    Ok(newly_unlocked)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::pomodoro_service::{self, Phase};

    #[tokio::test]
    async fn first_focus_unlocks_after_one_completed_session() {
        let pool = crate::db::init_test_pool().await;
        let session = pomodoro_service::start(&pool, Phase::Focus, 1500)
            .await
            .unwrap();
        pomodoro_service::complete(&pool, session.id, 1500)
            .await
            .unwrap();

        let unlocked = evaluate_all(&pool).await.unwrap();
        assert!(unlocked.iter().any(|a| a.id == "first_focus"));

        // Second evaluate_all must NOT re-unlock / re-award.
        let unlocked_again = evaluate_all(&pool).await.unwrap();
        assert!(!unlocked_again.iter().any(|a| a.id == "first_focus"));
    }

    #[tokio::test]
    async fn progress_caps_at_target_for_display() {
        let pool = crate::db::init_test_pool().await;
        for _ in 0..3 {
            let s = pomodoro_service::start(&pool, Phase::Focus, 60)
                .await
                .unwrap();
            pomodoro_service::complete(&pool, s.id, 60).await.unwrap();
        }
        let list = list_with_progress(&pool).await.unwrap();
        let first_focus = list
            .iter()
            .find(|a| a.achievement.id == "first_focus")
            .unwrap();
        assert_eq!(first_focus.progress, 1); // target is 1, capped even if more occurred
        assert!(first_focus.unlocked);
    }
}
