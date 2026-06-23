//! F08 — Smart Reminder.
//!
//! Repeat-rule resolution (spec §7 edge case re: DST) always recomputes
//! `next_fire_at` from the *local wall-clock* components (year/month/day/
//! hour/minute) of the previous fire time plus the rule, rather than adding
//! a fixed offset in seconds — so "daily at 9am" stays 9am across a DST
//! transition instead of drifting to 8am or 10am.

use crate::db::models::Reminder;
use crate::error::{AppError, AppResult};
use chrono::{DateTime, Datelike, Duration, Local, TimeZone, Timelike};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", tag = "type")]
pub enum RepeatRule {
    None,
    Daily,
    Weekly,
    Custom { days_of_week: Vec<u8> }, // 0=Sun .. 6=Sat
}

impl RepeatRule {
    pub fn rule_str(&self) -> &'static str {
        match self {
            RepeatRule::None => "none",
            RepeatRule::Daily => "daily",
            RepeatRule::Weekly => "weekly",
            RepeatRule::Custom { .. } => "custom",
        }
    }
    pub fn payload_json(&self) -> Option<String> {
        match self {
            RepeatRule::Custom { days_of_week } => {
                Some(serde_json::json!({ "days": days_of_week }).to_string())
            }
            _ => None,
        }
    }
}

/// Given the previous fire time and the rule, compute the next fire time
/// preserving local wall-clock hour/minute (DST-safe per module doc).
pub fn next_fire_after(previous: DateTime<Local>, rule: &RepeatRule) -> Option<DateTime<Local>> {
    match rule {
        RepeatRule::None => None,
        RepeatRule::Daily => Some(add_local_days(previous, 1)),
        RepeatRule::Weekly => Some(add_local_days(previous, 7)),
        RepeatRule::Custom { days_of_week } => {
            if days_of_week.is_empty() {
                return None;
            }
            let mut candidate = add_local_days(previous, 1);
            for _ in 0..8 {
                if days_of_week.contains(&(candidate.weekday().num_days_from_sunday() as u8)) {
                    return Some(candidate);
                }
                candidate = add_local_days(candidate, 1);
            }
            None
        }
    }
}

fn add_local_days(dt: DateTime<Local>, days: i64) -> DateTime<Local> {
    let naive = dt.naive_local().date() + Duration::days(days);
    Local
        .with_ymd_and_hms(
            naive.year(),
            naive.month(),
            naive.day(),
            dt.hour(),
            dt.minute(),
            dt.second(),
        )
        .single()
        .unwrap_or(dt + Duration::days(days)) // fallback for rare ambiguous-local-time edge case
}

pub async fn create(
    pool: &SqlitePool,
    title: String,
    body_template: String,
    rule: RepeatRule,
    first_fire_at: i64,
) -> AppResult<Reminder> {
    if title.trim().is_empty() {
        return Err(AppError::InvalidInput("title is required".into()));
    }
    let id = sqlx::query(
        "INSERT INTO reminders (title, body_template, repeat_rule, repeat_payload, next_fire_at, is_active)
         VALUES (?, ?, ?, ?, ?, 1)",
    )
    .bind(&title)
    .bind(&body_template)
    .bind(rule.rule_str())
    .bind(rule.payload_json())
    .bind(first_fire_at)
    .execute(pool)
    .await?
    .last_insert_rowid();

    fetch(pool, id).await
}

pub async fn fetch(pool: &SqlitePool, id: i64) -> AppResult<Reminder> {
    sqlx::query_as("SELECT * FROM reminders WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("reminder {id}")))
}

pub async fn list(pool: &SqlitePool) -> AppResult<Vec<Reminder>> {
    let rows = sqlx::query_as::<_, Reminder>("SELECT * FROM reminders ORDER BY next_fire_at ASC")
        .fetch_all(pool)
        .await?;
    Ok(rows)
}

pub async fn update(
    pool: &SqlitePool,
    id: i64,
    title: Option<String>,
    body_template: Option<String>,
    is_active: Option<bool>,
) -> AppResult<Reminder> {
    let existing = fetch(pool, id).await?;
    sqlx::query(
        "UPDATE reminders SET title = ?, body_template = ?, is_active = ?, updated_at = unixepoch() WHERE id = ?",
    )
    .bind(title.unwrap_or(existing.title))
    .bind(body_template.unwrap_or(existing.body_template))
    .bind(is_active.map(|b| b as i64).unwrap_or(existing.is_active))
    .bind(id)
    .execute(pool)
    .await?;
    fetch(pool, id).await
}

pub async fn delete(pool: &SqlitePool, id: i64) -> AppResult<()> {
    sqlx::query("DELETE FROM reminders WHERE id = ?").bind(id).execute(pool).await?;
    Ok(())
}

/// Called by the background reminder-poll loop (lib.rs) for every reminder
/// whose `next_fire_at` has passed. Fires the notification, logs the
/// completion (awards XP), and reschedules or deactivates.
pub async fn fire_due(pool: &SqlitePool, cat_name: &str) -> AppResult<Vec<Reminder>> {
    let now = chrono::Utc::now().timestamp();
    let due: Vec<Reminder> = sqlx::query_as(
        "SELECT * FROM reminders WHERE is_active = 1 AND next_fire_at <= ?",
    )
    .bind(now)
    .fetch_all(pool)
    .await?;

    let mut fired = Vec::new();
    for r in due {
        let rendered = r.body_template.replace("{name}", cat_name);
        sqlx::query("INSERT INTO reminder_completions (reminder_id) VALUES (?)")
            .bind(r.id)
            .execute(pool)
            .await?;
        crate::services::xp_service::award(
            pool,
            crate::services::xp_service::XpSource::Reminder,
            None,
            Some(r.id),
        )
        .await?;

        let rule: RepeatRule = match r.repeat_rule.as_str() {
            "daily" => RepeatRule::Daily,
            "weekly" => RepeatRule::Weekly,
            "custom" => {
                let days: Vec<u8> = r
                    .repeat_payload
                    .as_deref()
                    .and_then(|p| serde_json::from_str::<serde_json::Value>(p).ok())
                    .and_then(|v| v.get("days").cloned())
                    .and_then(|v| serde_json::from_value(v).ok())
                    .unwrap_or_default();
                RepeatRule::Custom { days_of_week: days }
            }
            _ => RepeatRule::None,
        };

        let previous_local = Local
            .timestamp_opt(r.next_fire_at, 0)
            .single()
            .unwrap_or_else(Local::now);

        match next_fire_after(previous_local, &rule) {
            Some(next) => {
                sqlx::query("UPDATE reminders SET next_fire_at = ? WHERE id = ?")
                    .bind(next.timestamp())
                    .bind(r.id)
                    .execute(pool)
                    .await?;
            }
            None => {
                sqlx::query("UPDATE reminders SET is_active = 0 WHERE id = ?")
                    .bind(r.id)
                    .execute(pool)
                    .await?;
            }
        }

        fired.push(Reminder { body_template: rendered, ..r });
    }
    Ok(fired)
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn daily_rule_preserves_hour_minute() {
        let prev = Local.with_ymd_and_hms(2026, 3, 14, 9, 0, 0).unwrap();
        let next = next_fire_after(prev, &RepeatRule::Daily).unwrap();
        assert_eq!(next.hour(), 9);
        assert_eq!(next.minute(), 0);
        assert_eq!((next.date_naive() - prev.date_naive()).num_days(), 1);
    }

    #[test]
    fn custom_rule_finds_next_matching_weekday() {
        // Wednesday 2026-03-11, rule = Mon(1)/Fri(5)
        let prev = Local.with_ymd_and_hms(2026, 3, 11, 8, 30, 0).unwrap();
        let rule = RepeatRule::Custom { days_of_week: vec![1, 5] };
        let next = next_fire_after(prev, &rule).unwrap();
        assert_eq!(next.weekday().num_days_from_sunday(), 5); // Friday
    }

    #[test]
    fn none_rule_has_no_next_fire() {
        let prev = Local::now();
        assert!(next_fire_after(prev, &RepeatRule::None).is_none());
    }

    #[tokio::test]
    async fn create_and_fire_due_awards_xp_and_reschedules() {
        let pool = crate::db::init_test_pool().await;
        let r = create(
            &pool,
            "Drink water".into(),
            "Hey {name}, waktunya minum air.".into(),
            RepeatRule::Daily,
            chrono::Utc::now().timestamp() - 10, // already due
        )
        .await
        .unwrap();

        let fired = fire_due(&pool, "Comnyang").await.unwrap();
        assert_eq!(fired.len(), 1);
        assert!(fired[0].body_template.contains("Comnyang"));

        let updated = fetch(&pool, r.id).await.unwrap();
        assert!(updated.next_fire_at > chrono::Utc::now().timestamp());
        assert_eq!(updated.is_active, 1);
    }
}
