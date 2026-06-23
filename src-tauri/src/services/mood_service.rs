//! F04 — Mood System.
//!
//! Mood is intentionally NOT persisted as "current mood" in `cat_state` —
//! it's a derived, recomputed-on-signal-change value (architecture.md §5),
//! so the engine can change mood instantly without a DB round-trip. The
//! `mood_log` table exists only for analytics/QA debug-overlay history
//! (specification.md FR-04 AC: "mood is observable via a debug overlay").
//!
//! Priority order matters: each rule below is checked in order and the
//! first match wins, so e.g. an active focus session always shows as
//! Focused even if other signals would suggest Lonely.

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Mood {
    Happy,
    Focused,
    Sleepy,
    Curious,
    Hungry,
    Lonely,
}

impl Mood {
    pub fn as_str(&self) -> &'static str {
        match self {
            Mood::Happy => "happy",
            Mood::Focused => "focused",
            Mood::Sleepy => "sleepy",
            Mood::Curious => "curious",
            Mood::Hungry => "hungry",
            Mood::Lonely => "lonely",
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default)]
pub struct MoodSignals {
    /// Seconds since the user last interacted with the cat or app (drag,
    /// click, keyboard/mouse activity in tracked apps).
    pub idle_seconds: i64,
    /// Whether a Pomodoro focus phase is currently running.
    pub focus_session_active: bool,
    /// Local hour of day, 0-23.
    pub hour_of_day: u8,
    /// Number of direct pet interactions (drag/click/pat) in the last hour.
    pub interactions_last_hour: u32,
    /// Consecutive hours of detected work activity without a break.
    pub consecutive_work_hours: f32,
}

const SLEEPY_IDLE_SECONDS: i64 = 60 * 60; // 1h idle
const LONELY_IDLE_SECONDS: i64 = 60 * 60 * 4; // 4h idle
const HUNGRY_IDLE_SECONDS: i64 = 60 * 60 * 2; // 2h idle (needs attention, before "lonely")
const CURIOUS_INTERACTION_THRESHOLD: u32 = 5; // >5 interactions/hr = lively engagement
const NIGHT_HOUR_START: u8 = 0;
const NIGHT_HOUR_END: u8 = 5;

pub fn compute_mood(signals: MoodSignals) -> Mood {
    if signals.focus_session_active {
        return Mood::Focused;
    }
    if signals.idle_seconds >= LONELY_IDLE_SECONDS {
        return Mood::Lonely;
    }
    if signals.idle_seconds >= SLEEPY_IDLE_SECONDS
        || (signals.hour_of_day >= NIGHT_HOUR_START && signals.hour_of_day <= NIGHT_HOUR_END)
    {
        return Mood::Sleepy;
    }
    if signals.idle_seconds >= HUNGRY_IDLE_SECONDS {
        return Mood::Hungry;
    }
    if signals.interactions_last_hour > CURIOUS_INTERACTION_THRESHOLD {
        return Mood::Curious;
    }
    Mood::Happy
}

pub async fn log_mood(pool: &SqlitePool, mood: Mood) -> crate::error::AppResult<()> {
    sqlx::query("INSERT INTO mood_log (mood) VALUES (?)")
        .bind(mood.as_str())
        .execute(pool)
        .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base() -> MoodSignals {
        MoodSignals {
            idle_seconds: 0,
            focus_session_active: false,
            hour_of_day: 14,
            interactions_last_hour: 1,
            consecutive_work_hours: 1.0,
        }
    }

    #[test]
    fn focus_session_always_wins() {
        let mut s = base();
        s.idle_seconds = LONELY_IDLE_SECONDS + 100;
        s.focus_session_active = true;
        assert_eq!(compute_mood(s), Mood::Focused);
    }

    #[test]
    fn long_idle_is_lonely() {
        let mut s = base();
        s.idle_seconds = LONELY_IDLE_SECONDS;
        assert_eq!(compute_mood(s), Mood::Lonely);
    }

    #[test]
    fn night_hours_are_sleepy() {
        let mut s = base();
        s.hour_of_day = 2;
        assert_eq!(compute_mood(s), Mood::Sleepy);
    }

    #[test]
    fn moderate_idle_is_hungry() {
        let mut s = base();
        s.idle_seconds = HUNGRY_IDLE_SECONDS + 10;
        assert_eq!(compute_mood(s), Mood::Hungry);
    }

    #[test]
    fn high_interaction_is_curious() {
        let mut s = base();
        s.interactions_last_hour = 10;
        assert_eq!(compute_mood(s), Mood::Curious);
    }

    #[test]
    fn default_is_happy() {
        assert_eq!(compute_mood(base()), Mood::Happy);
    }
}
