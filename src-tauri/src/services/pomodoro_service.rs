//! F07 — Pomodoro Focus Mode.
//!
//! Idempotency (spec FR-07 AC): `xp_awarded` is stored on the session row
//! itself and checked before awarding XP, so a duplicate `complete` call
//! (e.g. frontend retry after a dropped IPC response) never double-pays.
//! Crash recovery (spec §7 edge cases): on startup, `reconcile_stale_sessions`
//! marks any `running` session older than 2x its planned duration as
//! `abandoned` with zero XP, so an app force-quit can't leave a session
//! "running" forever and silently blocking new sessions.

use crate::db::models::PomodoroSession;
use crate::error::{AppError, AppResult};
use crate::services::xp_service::{self, XpSource};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Phase {
    Focus,
    Break,
}
impl Phase {
    fn as_str(&self) -> &'static str {
        match self {
            Phase::Focus => "focus",
            Phase::Break => "break",
        }
    }
}

pub async fn start(
    pool: &SqlitePool,
    phase: Phase,
    planned_seconds: i64,
) -> AppResult<PomodoroSession> {
    if planned_seconds <= 0 {
        return Err(AppError::InvalidInput("planned_seconds must be > 0".into()));
    }
    let id = sqlx::query(
        "INSERT INTO pomodoro_sessions (phase, planned_seconds, status) VALUES (?, ?, 'running')",
    )
    .bind(phase.as_str())
    .bind(planned_seconds)
    .execute(pool)
    .await?
    .last_insert_rowid();

    fetch(pool, id).await
}

pub async fn pause(pool: &SqlitePool, session_id: i64) -> AppResult<PomodoroSession> {
    set_status(pool, session_id, "paused").await
}

pub async fn resume(pool: &SqlitePool, session_id: i64) -> AppResult<PomodoroSession> {
    set_status(pool, session_id, "running").await
}

async fn set_status(
    pool: &SqlitePool,
    session_id: i64,
    status: &str,
) -> AppResult<PomodoroSession> {
    let session = fetch(pool, session_id).await?;
    if session.status == "completed" || session.status == "abandoned" {
        return Err(AppError::InvalidInput(format!(
            "cannot transition a {} session",
            session.status
        )));
    }
    sqlx::query("UPDATE pomodoro_sessions SET status = ? WHERE id = ?")
        .bind(status)
        .bind(session_id)
        .execute(pool)
        .await?;
    fetch(pool, session_id).await
}

pub struct CompleteResult {
    pub session: PomodoroSession,
    pub xp_awarded: i64,
}

pub async fn complete(
    pool: &SqlitePool,
    session_id: i64,
    actual_seconds: i64,
) -> AppResult<CompleteResult> {
    let mut tx = pool.begin().await?;
    let session: PomodoroSession = sqlx::query_as("SELECT * FROM pomodoro_sessions WHERE id = ?")
        .bind(session_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("pomodoro session {session_id}")))?;

    if session.status == "completed" {
        // Idempotent: already paid out, return as-is rather than erroring,
        // since the frontend may legitimately retry after a network blip.
        tx.commit().await?;
        return Ok(CompleteResult {
            session,
            xp_awarded: 0,
        });
    }

    sqlx::query(
        "UPDATE pomodoro_sessions SET status = 'completed', actual_seconds = ?, ended_at = unixepoch() WHERE id = ?",
    )
    .bind(actual_seconds)
    .bind(session_id)
    .execute(&mut *tx)
    .await?;

    let xp_amount = if session.phase == "focus" {
        xp_service::XP_POMODORO_COMPLETE
    } else {
        0
    };
    if xp_amount > 0 {
        sqlx::query("UPDATE pomodoro_sessions SET xp_awarded = ? WHERE id = ?")
            .bind(xp_amount)
            .bind(session_id)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;

    if xp_amount > 0 {
        xp_service::award(pool, XpSource::Pomodoro, Some(xp_amount), Some(session_id)).await?;
    }

    let updated = fetch(pool, session_id).await?;
    Ok(CompleteResult {
        session: updated,
        xp_awarded: xp_amount,
    })
}

pub async fn fetch(pool: &SqlitePool, session_id: i64) -> AppResult<PomodoroSession> {
    sqlx::query_as("SELECT * FROM pomodoro_sessions WHERE id = ?")
        .bind(session_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("pomodoro session {session_id}")))
}

pub async fn history(
    pool: &SqlitePool,
    from: Option<i64>,
    to: Option<i64>,
) -> AppResult<Vec<PomodoroSession>> {
    let from = from.unwrap_or(0);
    let to = to.unwrap_or(i64::MAX);
    let rows = sqlx::query_as::<_, PomodoroSession>(
        "SELECT * FROM pomodoro_sessions WHERE started_at BETWEEN ? AND ? ORDER BY started_at DESC",
    )
    .bind(from)
    .bind(to)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

/// Run on app startup (see lib.rs setup hook). See module doc for rationale.
pub async fn reconcile_stale_sessions(pool: &SqlitePool) -> AppResult<u64> {
    let result = sqlx::query(
        "UPDATE pomodoro_sessions
         SET status = 'abandoned', ended_at = unixepoch()
         WHERE status = 'running'
           AND started_at < (unixepoch() - planned_seconds * 2)",
    )
    .execute(pool)
    .await?;
    Ok(result.rows_affected())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn completing_focus_session_awards_xp_exactly_once() {
        let pool = crate::db::init_test_pool().await;
        let session = start(&pool, Phase::Focus, 1500).await.unwrap();

        let first = complete(&pool, session.id, 1500).await.unwrap();
        assert_eq!(first.xp_awarded, xp_service::XP_POMODORO_COMPLETE);

        let second = complete(&pool, session.id, 1500).await.unwrap();
        assert_eq!(
            second.xp_awarded, 0,
            "second complete() must not re-award XP"
        );

        let cat: crate::db::models::CatState =
            sqlx::query_as("SELECT * FROM cat_state WHERE id = 1")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(cat.xp_total, xp_service::XP_POMODORO_COMPLETE);
    }

    #[tokio::test]
    async fn break_phase_awards_no_xp() {
        let pool = crate::db::init_test_pool().await;
        let session = start(&pool, Phase::Break, 300).await.unwrap();
        let result = complete(&pool, session.id, 300).await.unwrap();
        assert_eq!(result.xp_awarded, 0);
    }

    #[tokio::test]
    async fn stale_running_session_is_abandoned_on_reconcile() {
        let pool = crate::db::init_test_pool().await;
        let session = start(&pool, Phase::Focus, 60).await.unwrap();
        // Force it to look old.
        sqlx::query("UPDATE pomodoro_sessions SET started_at = unixepoch() - 1000 WHERE id = ?")
            .bind(session.id)
            .execute(&pool)
            .await
            .unwrap();
        let affected = reconcile_stale_sessions(&pool).await.unwrap();
        assert_eq!(affected, 1);
        let updated = fetch(&pool, session.id).await.unwrap();
        assert_eq!(updated.status, "abandoned");
    }
}
