//! Analytics — implements every event in PRD §13 / specification.md §6.
//!
//! Events are written to the local `analytics_events` queue first (so the
//! app works fully offline and never blocks a user action on a network
//! call), then a background flusher (lib.rs) POSTs unflushed rows to
//! PostHog in batches and marks them `flushed = 1`. This also means no
//! event is ever lost to a dropped network request — it just retries on
//! the next flush tick.

use crate::error::AppResult;
use serde::Serialize;
use serde_json::Value;
use sqlx::SqlitePool;

pub async fn track(pool: &SqlitePool, event_name: &str, payload: impl Serialize) -> AppResult<()> {
    let payload_json = serde_json::to_string(&payload).unwrap_or_else(|_| "{}".to_string());
    sqlx::query("INSERT INTO analytics_events (event_name, payload_json) VALUES (?, ?)")
        .bind(event_name)
        .bind(payload_json)
        .execute(pool)
        .await?;
    Ok(())
}

pub struct QueuedEvent {
    pub id: i64,
    pub event_name: String,
    pub payload: Value,
}

pub async fn unflushed_batch(pool: &SqlitePool, limit: i64) -> AppResult<Vec<QueuedEvent>> {
    let rows: Vec<(i64, String, String)> = sqlx::query_as(
        "SELECT id, event_name, payload_json FROM analytics_events WHERE flushed = 0 ORDER BY id ASC LIMIT ?",
    )
    .bind(limit)
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(|(id, event_name, payload_json)| QueuedEvent {
            id,
            event_name,
            payload: serde_json::from_str(&payload_json).unwrap_or(Value::Null),
        })
        .collect())
}

pub async fn mark_flushed(pool: &SqlitePool, ids: &[i64]) -> AppResult<()> {
    if ids.is_empty() {
        return Ok(());
    }
    let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let query = format!("UPDATE analytics_events SET flushed = 1 WHERE id IN ({placeholders})");
    let mut q = sqlx::query(&query);
    for id in ids {
        q = q.bind(id);
    }
    q.execute(pool).await?;
    Ok(())
}

/// Posts a batch to PostHog. Network/credential failures are swallowed at
/// the call site (lib.rs flusher) — analytics must never crash or block
/// the app; rows simply remain `flushed = 0` and retry next tick.
pub async fn flush_to_posthog(
    client: &reqwest::Client,
    api_key: &str,
    host: &str,
    batch: &[QueuedEvent],
) -> AppResult<()> {
    if batch.is_empty() {
        return Ok(());
    }
    let events: Vec<Value> = batch
        .iter()
        .map(|e| {
            serde_json::json!({
                "event": e.event_name,
                "properties": e.payload,
                "api_key": api_key,
            })
        })
        .collect();

    client
        .post(format!("{host}/batch"))
        .json(&serde_json::json!({ "api_key": api_key, "batch": events }))
        .send()
        .await
        .map_err(|e| crate::error::AppError::Internal(format!("posthog flush failed: {e}")))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn track_then_batch_then_mark_flushed() {
        let pool = crate::db::init_test_pool().await;
        track(&pool, "app_open", serde_json::json!({}))
            .await
            .unwrap();
        track(
            &pool,
            "xp_earned",
            serde_json::json!({"source":"pomodoro","amount":20}),
        )
        .await
        .unwrap();

        let batch = unflushed_batch(&pool, 10).await.unwrap();
        assert_eq!(batch.len(), 2);

        mark_flushed(&pool, &batch.iter().map(|e| e.id).collect::<Vec<_>>())
            .await
            .unwrap();
        let remaining = unflushed_batch(&pool, 10).await.unwrap();
        assert_eq!(remaining.len(), 0);
    }
}
