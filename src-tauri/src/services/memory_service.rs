//! F11 — AI Memory Vault.
//!
//! Search uses the `ai_memory_fts` FTS5 virtual table (schema.sql §5) kept
//! in sync via triggers, so search stays fast (<200ms @ 10k rows, spec
//! FR-11 AC) without the service needing to manage the index itself. Empty
//! query falls back to "most recent N" (spec §7 edge case) rather than an
//! empty result set, since an empty search box is a navigation action, not
//! a "find nothing" action.

use crate::db::models::AiMemoryEntry;
use crate::error::{AppError, AppResult};
use sqlx::SqlitePool;

pub async fn save(
    pool: &SqlitePool,
    kind: &str,
    content: &str,
    source_provider: Option<&str>,
    tags: &[String],
) -> AppResult<AiMemoryEntry> {
    if !["prompt", "response", "snippet"].contains(&kind) {
        return Err(AppError::InvalidInput(format!("invalid kind: {kind}")));
    }
    if content.trim().is_empty() {
        return Err(AppError::InvalidInput("content cannot be empty".into()));
    }

    let mut tx = pool.begin().await?;
    let id = sqlx::query(
        "INSERT INTO ai_memory_entries (kind, content, source_provider) VALUES (?, ?, ?)",
    )
    .bind(kind)
    .bind(content)
    .bind(source_provider)
    .execute(&mut *tx)
    .await?
    .last_insert_rowid();

    for tag in tags {
        let tag = tag.trim().to_lowercase();
        if tag.is_empty() {
            continue;
        }
        sqlx::query("INSERT INTO ai_memory_tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING")
            .bind(&tag)
            .execute(&mut *tx)
            .await?;
        let tag_id: i64 = sqlx::query_scalar("SELECT id FROM ai_memory_tags WHERE name = ?")
            .bind(&tag)
            .fetch_one(&mut *tx)
            .await?;
        sqlx::query(
            "INSERT INTO ai_memory_entry_tags (entry_id, tag_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
        )
        .bind(id)
        .bind(tag_id)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;

    sqlx::query_as("SELECT * FROM ai_memory_entries WHERE id = ?")
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(Into::into)
}

pub async fn search(pool: &SqlitePool, query: &str, tag: Option<&str>, limit: i64) -> AppResult<Vec<AiMemoryEntry>> {
    let query = query.trim();

    if query.is_empty() {
        // Fallback: most recent N (optionally tag-filtered).
        let rows = if let Some(tag) = tag {
            sqlx::query_as::<_, AiMemoryEntry>(
                "SELECT e.* FROM ai_memory_entries e
                 JOIN ai_memory_entry_tags et ON et.entry_id = e.id
                 JOIN ai_memory_tags t ON t.id = et.tag_id AND t.name = ?
                 ORDER BY e.created_at DESC LIMIT ?",
            )
            .bind(tag)
            .bind(limit)
            .fetch_all(pool)
            .await?
        } else {
            sqlx::query_as::<_, AiMemoryEntry>(
                "SELECT * FROM ai_memory_entries ORDER BY created_at DESC LIMIT ?",
            )
            .bind(limit)
            .fetch_all(pool)
            .await?
        };
        return Ok(rows);
    }

    // FTS5 MATCH; sanitize naive special characters the user might type.
    let sanitized = query.replace('"', "");
    let rows = sqlx::query_as::<_, AiMemoryEntry>(
        "SELECT e.* FROM ai_memory_entries e
         JOIN ai_memory_fts f ON f.rowid = e.id
         WHERE f.content MATCH ?
         ORDER BY rank LIMIT ?",
    )
    .bind(format!("{sanitized}*"))
    .bind(limit)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn delete(pool: &SqlitePool, id: i64) -> AppResult<()> {
    sqlx::query("DELETE FROM ai_memory_entries WHERE id = ?").bind(id).execute(pool).await?;
    Ok(())
}

pub async fn list_tags(pool: &SqlitePool) -> AppResult<Vec<String>> {
    let rows: Vec<String> = sqlx::query_scalar("SELECT name FROM ai_memory_tags ORDER BY name")
        .fetch_all(pool)
        .await?;
    Ok(rows)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn save_and_full_text_search() {
        let pool = crate::db::init_test_pool().await;
        save(&pool, "snippet", "useEffect cleanup pattern in React", None, &["react".into()]).await.unwrap();
        save(&pool, "prompt", "explain rust ownership", None, &["rust".into()]).await.unwrap();

        let results = search(&pool, "react", None, 10).await.unwrap();
        assert_eq!(results.len(), 1);
        assert!(results[0].content.contains("React"));
    }

    #[tokio::test]
    async fn empty_query_returns_recent_not_empty() {
        let pool = crate::db::init_test_pool().await;
        save(&pool, "snippet", "first entry", None, &[]).await.unwrap();
        save(&pool, "snippet", "second entry", None, &[]).await.unwrap();
        let results = search(&pool, "", None, 10).await.unwrap();
        assert_eq!(results.len(), 2);
    }

    #[tokio::test]
    async fn tag_filter_narrows_results() {
        let pool = crate::db::init_test_pool().await;
        save(&pool, "snippet", "entry A", None, &["work".into()]).await.unwrap();
        save(&pool, "snippet", "entry B", None, &["personal".into()]).await.unwrap();
        let results = search(&pool, "", Some("work"), 10).await.unwrap();
        assert_eq!(results.len(), 1);
        assert!(results[0].content.contains('A'));
    }

    #[tokio::test]
    async fn rejects_invalid_kind() {
        let pool = crate::db::init_test_pool().await;
        let err = save(&pool, "bogus", "x", None, &[]).await;
        assert!(err.is_err());
    }
}
