//! F06 — XP & Growth System.
//!
//! ## Leveling formula — design note
//! PRD §10 gives three anchor points: Level 1 = 100 XP, Level 10 = 1,000 XP,
//! Level 50 = 10,000 XP. These three points are NOT collinear under a single
//! power-law or simple polynomial (verified: no `a*L^b` fits all three), so
//! rather than silently picking a formula that drifts from the PRD numbers,
//! this implementation uses **piecewise-linear interpolation through the
//! exact anchors**, which is the only approach that hits all three exactly:
//!
//!   - L in [1, 10]:  cumulative(L) = 100 * L
//!   - L in [10, 50]: cumulative(L) = 1000 + (L-10) * 225
//!   - L > 50:        cumulative(L) = 10000 + (L-50) * 450  (extrapolated;
//!                     PRD does not specify Legendary-band pacing, so the
//!                     per-level cost is doubled again here as a placeholder
//!                     — flagged in docs/roadmap.md as a balancing task for
//!                     post-launch telemetry, since "XP Earned/User > 100/week"
//!                     is a target metric that should inform retuning.)
//!
//! Growth stage bands (not specified numerically in PRD beyond labels, so
//! mapped to level ranges deliberately so each stage takes meaningfully
//! longer than the last):
//!   Kitten 1-9, Teen 10-24, Adult 25-49, Legendary 50+

use crate::db::models::{CatState, XpEvent};
use crate::error::AppResult;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

pub const XP_POMODORO_COMPLETE: i64 = 20;
pub const XP_REMINDER_COMPLETE: i64 = 5;
pub const XP_FOCUS_SESSION: i64 = 10;
pub const XP_ACHIEVEMENT: i64 = 50;
pub const XP_RARE_EVENT: i64 = 100;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum XpSource {
    Pomodoro,
    Reminder,
    FocusSession,
    Achievement,
    RareEvent,
}

impl XpSource {
    pub fn as_str(&self) -> &'static str {
        match self {
            XpSource::Pomodoro => "pomodoro",
            XpSource::Reminder => "reminder",
            XpSource::FocusSession => "focus_session",
            XpSource::Achievement => "achievement",
            XpSource::RareEvent => "rare_event",
        }
    }

    pub fn default_amount(&self) -> i64 {
        match self {
            XpSource::Pomodoro => XP_POMODORO_COMPLETE,
            XpSource::Reminder => XP_REMINDER_COMPLETE,
            XpSource::FocusSession => XP_FOCUS_SESSION,
            XpSource::Achievement => XP_ACHIEVEMENT,
            XpSource::RareEvent => XP_RARE_EVENT,
        }
    }
}

/// Cumulative XP required to *reach* `level` (level 0 => 0 XP).
pub fn cumulative_xp_for_level(level: u32) -> i64 {
    match level {
        0 => 0,
        1..=10 => 100 * level as i64,
        11..=50 => 1000 + (level as i64 - 10) * 225,
        _ => 10_000 + (level as i64 - 50) * 450,
    }
}

/// Inverse of `cumulative_xp_for_level`: given total XP, what level is that?
/// Monotonic piecewise-linear -> simple forward scan is fine (levels are
/// small integers in practice; this is never a hot loop).
pub fn level_for_xp(xp_total: i64) -> u32 {
    let mut level: u32 = 1;
    while cumulative_xp_for_level(level + 1) <= xp_total {
        level += 1;
        if level > 100_000 {
            break; // safety guard against pathological input
        }
    }
    level
}

pub fn growth_stage_for_level(level: u32) -> &'static str {
    match level {
        0..=9 => "kitten",
        10..=24 => "teen",
        25..=49 => "adult",
        _ => "legendary",
    }
}

pub struct AwardResult {
    pub cat_state: CatState,
    pub leveled_up: bool,
    pub previous_level: u32,
}

/// Awards XP atomically: inserts the ledger row, recomputes level/growth
/// stage, and persists `cat_state` — all in one transaction so a crash
/// mid-award can never produce a ledger entry without the corresponding
/// state update (NFR-02).
pub async fn award(
    pool: &SqlitePool,
    source: XpSource,
    amount: Option<i64>,
    ref_id: Option<i64>,
) -> AppResult<AwardResult> {
    let amount = amount.unwrap_or_else(|| source.default_amount());
    let mut tx = pool.begin().await?;

    sqlx::query("INSERT INTO xp_events (source, amount, ref_id) VALUES (?, ?, ?)")
        .bind(source.as_str())
        .bind(amount)
        .bind(ref_id)
        .execute(&mut *tx)
        .await?;

    let before: CatState = sqlx::query_as("SELECT * FROM cat_state WHERE id = 1")
        .fetch_one(&mut *tx)
        .await?;

    let new_total = before.xp_total + amount;
    let new_level = level_for_xp(new_total);
    let new_stage = growth_stage_for_level(new_level);
    let leveled_up = new_level as i64 > before.level;

    sqlx::query(
        "UPDATE cat_state SET xp_total = ?, level = ?, growth_stage = ?, updated_at = unixepoch() WHERE id = 1",
    )
    .bind(new_total)
    .bind(new_level as i64)
    .bind(new_stage)
    .execute(&mut *tx)
    .await?;

    let after: CatState = sqlx::query_as("SELECT * FROM cat_state WHERE id = 1")
        .fetch_one(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(AwardResult {
        cat_state: after,
        leveled_up,
        previous_level: before.level as u32,
    })
}

pub async fn recent_events(pool: &SqlitePool, limit: i64) -> AppResult<Vec<XpEvent>> {
    let rows = sqlx::query_as::<_, XpEvent>(
        "SELECT * FROM xp_events ORDER BY created_at DESC LIMIT ?",
    )
    .bind(limit)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn anchors_match_prd_exactly() {
        assert_eq!(cumulative_xp_for_level(1), 100);
        assert_eq!(cumulative_xp_for_level(10), 1000);
        assert_eq!(cumulative_xp_for_level(50), 10_000);
    }

    #[test]
    fn level_for_xp_is_inverse_of_cumulative() {
        for level in 1..80u32 {
            let xp = cumulative_xp_for_level(level);
            assert_eq!(level_for_xp(xp), level, "failed at level {level}");
        }
    }

    #[test]
    fn level_for_xp_below_first_anchor_is_level_one() {
        assert_eq!(level_for_xp(0), 1);
        assert_eq!(level_for_xp(99), 1);
    }

    #[test]
    fn growth_stage_bands() {
        assert_eq!(growth_stage_for_level(1), "kitten");
        assert_eq!(growth_stage_for_level(9), "kitten");
        assert_eq!(growth_stage_for_level(10), "teen");
        assert_eq!(growth_stage_for_level(25), "adult");
        assert_eq!(growth_stage_for_level(50), "legendary");
    }

    #[tokio::test]
    async fn award_is_transactional_and_updates_state() {
        let pool = crate::db::init_test_pool().await;
        let result = award(&pool, XpSource::Pomodoro, None, Some(1)).await.unwrap();
        assert_eq!(result.cat_state.xp_total, 20);
        assert!(!result.leveled_up);

        // Award enough to cross level 1 -> 2 boundary (need 100 cumulative)
        for _ in 0..4 {
            award(&pool, XpSource::Pomodoro, None, None).await.unwrap();
        }
        let final_state: CatState = sqlx::query_as("SELECT * FROM cat_state WHERE id = 1")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert!(final_state.xp_total >= 100);
        assert!(final_state.level >= 2);
    }
}
