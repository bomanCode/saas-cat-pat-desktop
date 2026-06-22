//! F14 — Rare Event Engine.
//!
//! Probabilities are intentionally data-described in one place (`WEIGHTS`)
//! so designers can retune drop rates without touching roll logic. AC
//! "probabilities sum to a documented total" is enforced by a unit test
//! that sums the table, not just a comment.
//!
//! Roll cadence (default hourly, spec FR-14) is driven by the background
//! loop in lib.rs; this module only owns the pure "given a roll, what (if
//! anything) happened" decision plus persistence, so it's testable without
//! a timer.

use crate::db::models::RareEventLogRow;
use crate::error::AppResult;
use crate::services::xp_service::{self, XpSource};
use rand::Rng;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RareEventType {
    GoldenCat,
    GhostCat,
    NinjaCat,
}
impl RareEventType {
    fn as_str(&self) -> &'static str {
        match self {
            RareEventType::GoldenCat => "golden_cat",
            RareEventType::GhostCat => "ghost_cat",
            RareEventType::NinjaCat => "ninja_cat",
        }
    }
}

/// (event, weight) out of TOTAL_WEIGHT_DENOM. Remaining probability mass is
/// "nothing happens" — i.e. these are NOT renormalized to sum to 1; they're
/// the chance *per roll* that a given rare event fires at all.
const WEIGHTS: &[(RareEventType, u32)] = &[
    (RareEventType::GoldenCat, 2), // 0.2%
    (RareEventType::GhostCat, 3),  // 0.3%
    (RareEventType::NinjaCat, 5),  // 0.5%
];
const TOTAL_WEIGHT_DENOM: u32 = 1000; // i.e. weights are in units of 0.1%

/// Pure roll function — takes randomness as an injected `roll` in
/// `[0, TOTAL_WEIGHT_DENOM)` so it's deterministically testable.
pub fn resolve_roll(roll: u32) -> Option<RareEventType> {
    let mut acc = 0u32;
    for (event, weight) in WEIGHTS {
        acc += weight;
        if roll < acc {
            return Some(*event);
        }
    }
    None
}

pub async fn maybe_trigger(pool: &SqlitePool) -> AppResult<Option<RareEventType>> {
    let roll = rand::thread_rng().gen_range(0..TOTAL_WEIGHT_DENOM);
    let outcome = resolve_roll(roll);
    if let Some(event) = outcome {
        sqlx::query("INSERT INTO rare_event_log (event_type) VALUES (?)")
            .bind(event.as_str())
            .execute(pool)
            .await?;
        xp_service::award(pool, XpSource::RareEvent, None, None).await?;
    }
    Ok(outcome)
}

pub async fn record_screenshot(pool: &SqlitePool, log_id: i64, path: String) -> AppResult<()> {
    sqlx::query("UPDATE rare_event_log SET screenshot_path = ?, shared = 1 WHERE id = ?")
        .bind(path)
        .bind(log_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn recent(pool: &SqlitePool, limit: i64) -> AppResult<Vec<RareEventLogRow>> {
    let rows = sqlx::query_as::<_, RareEventLogRow>(
        "SELECT * FROM rare_event_log ORDER BY triggered_at DESC LIMIT ?",
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
    fn weights_are_documented_and_small() {
        let total: u32 = WEIGHTS.iter().map(|(_, w)| w).sum();
        assert_eq!(total, 10); // 1.0% combined chance per roll, out of 1000 denom
        assert!(total < TOTAL_WEIGHT_DENOM);
    }

    #[test]
    fn roll_below_first_threshold_is_golden() {
        assert_eq!(resolve_roll(0), Some(RareEventType::GoldenCat));
        assert_eq!(resolve_roll(1), Some(RareEventType::GoldenCat));
    }

    #[test]
    fn roll_in_third_band_is_ninja() {
        assert_eq!(resolve_roll(7), Some(RareEventType::NinjaCat));
        assert_eq!(resolve_roll(9), Some(RareEventType::NinjaCat));
    }

    #[test]
    fn roll_above_all_thresholds_is_none() {
        assert_eq!(resolve_roll(10), None);
        assert_eq!(resolve_roll(999), None);
    }

    #[tokio::test]
    async fn triggered_event_awards_xp_and_logs() {
        let pool = crate::db::init_test_pool().await;
        // Roll enough times that at least one rare event is virtually
        // guaranteed (1% per roll, 2000 rolls).
        let mut triggered = false;
        for _ in 0..2000 {
            if maybe_trigger(&pool).await.unwrap().is_some() {
                triggered = true;
                break;
            }
        }
        assert!(triggered, "expected at least one rare event in 2000 rolls");
        let log = recent(&pool, 1).await.unwrap();
        assert_eq!(log.len(), 1);
    }
}
