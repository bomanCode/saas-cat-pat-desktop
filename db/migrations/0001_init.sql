-- ============================================================================
-- Comnyang 2.0 — SQLite Schema
-- Engine: SQLite 3.45+ (FTS5, STRICT tables, generated columns)
-- Location at runtime: $APPDATA/comnyang/comnyang.db
-- Applied via sqlx migrate (db/migrations/*.sql) — this file is the
-- consolidated reference; migrations/0001_init.sql is the actual source of truth.
-- ============================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- 1. CAT STATE — single row, MVP is single-profile (multi-profile is post-MVP)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cat_state (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    name            TEXT NOT NULL DEFAULT 'Comnyang',
    personality     TEXT NOT NULL DEFAULT 'smart'
                        CHECK (personality IN ('lazy','hyper','smart','clingy','tsundere')),
    personality_locked_until INTEGER NULL, -- unix ts; cooldown to prevent personality-switch spam
    level           INTEGER NOT NULL DEFAULT 1,
    xp_total        INTEGER NOT NULL DEFAULT 0,
    growth_stage    TEXT NOT NULL DEFAULT 'kitten'
                        CHECK (growth_stage IN ('kitten','teen','adult','legendary')),
    tier            TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free','pro')),
    created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT INTO cat_state (id) VALUES (1) ON CONFLICT(id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. XP EVENTS — append-only ledger; cat_state.xp_total is a derived cache
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS xp_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    source      TEXT NOT NULL
                    CHECK (source IN ('pomodoro','reminder','focus_session','achievement','rare_event')),
    amount      INTEGER NOT NULL CHECK (amount > 0),
    ref_id      INTEGER NULL,           -- e.g. pomodoro_sessions.id, achievements.id
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_xp_events_created ON xp_events(created_at);

-- ----------------------------------------------------------------------------
-- 3. POMODORO SESSIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pomodoro_sessions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    phase           TEXT NOT NULL CHECK (phase IN ('focus','break')),
    planned_seconds INTEGER NOT NULL CHECK (planned_seconds > 0),
    actual_seconds  INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'running'
                        CHECK (status IN ('running','paused','completed','abandoned')),
    xp_awarded      INTEGER NOT NULL DEFAULT 0, -- idempotency guard, see FR-07
    started_at      INTEGER NOT NULL DEFAULT (unixepoch()),
    ended_at        INTEGER NULL
);
CREATE INDEX IF NOT EXISTS idx_pomodoro_started ON pomodoro_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_pomodoro_status ON pomodoro_sessions(status);

-- ----------------------------------------------------------------------------
-- 4. REMINDERS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reminders (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT NOT NULL,
    body_template   TEXT NOT NULL DEFAULT '', -- e.g. "Hey {name}, waktunya minum air."
    repeat_rule     TEXT NOT NULL DEFAULT 'none' CHECK (repeat_rule IN ('none','daily','weekly','custom')),
    repeat_payload  TEXT NULL,  -- JSON, e.g. {"days":[1,3,5]}
    next_fire_at    INTEGER NOT NULL,
    is_active       INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
    created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_reminders_next_fire ON reminders(next_fire_at) WHERE is_active = 1;

CREATE TABLE IF NOT EXISTS reminder_completions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    reminder_id INTEGER NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
    completed_at INTEGER NOT NULL DEFAULT (unixepoch()),
    xp_awarded  INTEGER NOT NULL DEFAULT 5
);

-- ----------------------------------------------------------------------------
-- 5. AI MEMORY VAULT
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_memory_entries (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    kind            TEXT NOT NULL CHECK (kind IN ('prompt','response','snippet')),
    content         TEXT NOT NULL,
    source_provider TEXT NULL CHECK (source_provider IN ('openai','claude','gemini','ollama','manual')),
    pinned          INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0,1)),
    created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS ai_memory_tags (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS ai_memory_entry_tags (
    entry_id INTEGER NOT NULL REFERENCES ai_memory_entries(id) ON DELETE CASCADE,
    tag_id   INTEGER NOT NULL REFERENCES ai_memory_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (entry_id, tag_id)
);

-- Full text search index (FR-11: search <200ms @ 10k rows)
CREATE VIRTUAL TABLE IF NOT EXISTS ai_memory_fts USING fts5(
    content,
    content='ai_memory_entries',
    content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS ai_memory_ai AFTER INSERT ON ai_memory_entries BEGIN
    INSERT INTO ai_memory_fts(rowid, content) VALUES (new.id, new.content);
END;
CREATE TRIGGER IF NOT EXISTS ai_memory_ad AFTER DELETE ON ai_memory_entries BEGIN
    INSERT INTO ai_memory_fts(ai_memory_fts, rowid, content) VALUES ('delete', old.id, old.content);
END;
CREATE TRIGGER IF NOT EXISTS ai_memory_au AFTER UPDATE ON ai_memory_entries BEGIN
    INSERT INTO ai_memory_fts(ai_memory_fts, rowid, content) VALUES ('delete', old.id, old.content);
    INSERT INTO ai_memory_fts(rowid, content) VALUES (new.id, new.content);
END;

-- ----------------------------------------------------------------------------
-- 6. ACHIEVEMENTS — static catalog (seeded) + per-user unlock/progress
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS achievements (
    id          TEXT PRIMARY KEY,         -- slug, e.g. 'first_focus'
    title       TEXT NOT NULL,
    description TEXT NOT NULL,
    xp_reward   INTEGER NOT NULL DEFAULT 50,
    rule_type   TEXT NOT NULL,            -- evaluated by achievement_service rule registry
    rule_target INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS achievement_unlocks (
    achievement_id TEXT NOT NULL REFERENCES achievements(id),
    unlocked_at    INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (achievement_id)
);

CREATE TABLE IF NOT EXISTS achievement_progress (
    achievement_id TEXT NOT NULL REFERENCES achievements(id),
    progress       INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (achievement_id)
);

INSERT INTO achievements (id, title, description, xp_reward, rule_type, rule_target) VALUES
    ('first_focus',     'First Focus',     'Complete your first focus session.',      50, 'focus_sessions_completed', 1),
    ('pomodoro_master',  'Pomodoro Master', 'Complete 50 Pomodoro sessions.',           50, 'pomodoro_completed',       50),
    ('ai_explorer',      'AI Explorer',     'Save 10 entries to the AI Memory Vault.',  50, 'memory_entries_saved',     10),
    ('weekend_warrior',  'Weekend Warrior', 'Complete a focus session on Sat and Sun.', 50, 'weekend_sessions',         2),
    ('night_owl',        'Night Owl',       'Complete a focus session after 11 PM.',    50, 'late_night_sessions',      1)
ON CONFLICT(id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 7. RARE EVENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rare_event_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type  TEXT NOT NULL CHECK (event_type IN ('golden_cat','ghost_cat','ninja_cat')),
    triggered_at INTEGER NOT NULL DEFAULT (unixepoch()),
    screenshot_path TEXT NULL,
    shared      INTEGER NOT NULL DEFAULT 0 CHECK (shared IN (0,1))
);

-- ----------------------------------------------------------------------------
-- 8. DAILY STORIES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_stories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    story_date  TEXT NOT NULL UNIQUE,   -- 'YYYY-MM-DD' local
    content     TEXT NOT NULL,
    story_type  TEXT NOT NULL DEFAULT 'adventure' CHECK (story_type IN ('dream','adventure','funny')),
    generated_by TEXT NOT NULL DEFAULT 'template' CHECK (generated_by IN ('template','openai','claude','gemini','ollama')),
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ----------------------------------------------------------------------------
-- 9. MOOD SIGNAL LOG (lightweight, for analytics + debug overlay; not the
--    source of truth for "current mood" which is computed in-memory)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mood_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    mood        TEXT NOT NULL CHECK (mood IN ('happy','focused','sleepy','curious','hungry','lonely')),
    recorded_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_mood_log_recorded ON mood_log(recorded_at);

-- ----------------------------------------------------------------------------
-- 10. ANALYTICS EVENTS (local queue, flushed to PostHog by analytics_service)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event_name  TEXT NOT NULL,
    payload_json TEXT NOT NULL DEFAULT '{}',
    flushed     INTEGER NOT NULL DEFAULT 0 CHECK (flushed IN (0,1)),
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_analytics_flushed ON analytics_events(flushed);

-- ----------------------------------------------------------------------------
-- 11. APP SETTINGS — key/value, JSON values
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL -- JSON-encoded
);

INSERT INTO app_settings (key, value) VALUES
    ('ai_provider_default', '"ollama"'),
    ('distraction_patterns', '["youtube.com","tiktok.com","instagram.com","facebook.com"]'),
    ('notification_prefs', '{"reminders":true,"focusGuardian":true,"achievements":true}'),
    ('schema_version', '1')
ON CONFLICT(key) DO NOTHING;
