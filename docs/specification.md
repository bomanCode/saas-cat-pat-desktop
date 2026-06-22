# Comnyang 2.0 — Specification

SPARC Phase: Specification
Source: PRD v2.0

## 1. Scope

In scope (MVP, Phases 1–3 of PRD roadmap): F01–F14.
Out of scope (Post-MVP, Phases 4–5): Cloud Sync, Marketplace, AI Coach, Voice Interaction, Team Cats, Mobile Companion. These are stubbed as interfaces only (Section 9).

## 2. Functional Requirements

| ID | Feature | Requirement | Acceptance Criteria |
|---|---|---|---|
| FR-01 | Living Cat Engine | Cat renders on desktop with 6 behavior states (idle, sleeping, walking, watching_cursor, sitting, grooming), transitions driven by a deterministic state machine | 60 FPS sustained; CPU <5% average over 10 min idle; RAM <200MB; all 6 states reachable in automated state-machine test |
| FR-02 | Eye Follow | Pupils track cursor position with smoothing | No visible jitter (frame-to-frame pupil delta variance below threshold); angular accuracy >95% vs. true cursor vector; works across multi-monitor |
| FR-03 | Drag & Physics | Cat body draggable via pointer; stretch + wobble on drag/release | Stretch capped to anatomically plausible bounds (configurable max); wobble decays to rest within 1.5s; no physics explosion (NaN/Infinity guard) |
| FR-04 | Mood System | Mood in {Happy, Focused, Sleepy, Curious, Hungry, Lonely}, recomputed from activity/time/interaction signals | Mood transition occurs without explicit user action within defined signal thresholds; mood visibly changes animation set; mood is observable via a debug overlay for QA |
| FR-05 | Personality Engine | Personality in {Lazy, Hyper, Smart, Clingy, Tsundere}, assigned at onboarding (or via Pro unlock), persisted | Personality persists across app restarts; dialogue line selection is provably biased by personality (weighted pool, testable via seeded RNG) |
| FR-06 | XP & Growth | XP accrues from Pomodoro/Reminder/Focus/Achievement/RareEvent; level computed from XP via formula; growth stage in {Kitten, Teen, Adult, Legendary} mapped from level bands | XP updates reflected in UI within 1 frame of event; level persists; level-up emits exactly one event per threshold crossing (no double-fire on rapid XP gains) |
| FR-07 | Pomodoro | Focus/Break timer with Start/Pause/Resume/Stop, session history, XP reward on completion | Floating widget always accessible from pet window; history queryable by date range; XP only awarded once per completed session (idempotent on app crash/restart) |
| FR-08 | Smart Reminder | CRUD reminders with optional repeat rule (none/daily/weekly/custom), personality-flavored copy | Reminder fires within +/-5s of scheduled time while app running; repeat rule correctly reschedules; deleting a reminder cancels pending notification |
| FR-09 | Focus Guardian | During an active focus session, detect foreground app/window matching a distraction pattern list (YouTube, TikTok, Instagram, Facebook by default) and show a non-blocking friendly nudge | Nudge appears within 3s of distraction app gaining foreground focus; nudge auto-dismisses; user activity is never blocked or intercepted; gracefully no-ops on platforms without window-watch support (e.g. Wayland) |
| FR-10 | AI Presence Detection | Detect ChatGPT/Claude/Gemini in foreground (browser tab title heuristic or desktop app process name) and trigger thinking/waiting/celebration animations | Detection precision >90% on a labeled test set of window titles/process names; false-positive rate tracked and capped at <10% |
| FR-11 | AI Memory Vault | Save/bookmark prompt+response pairs and snippets; tag; full-text search | Search returns results in <200ms for <=10k entries (FTS5 index); tags many-to-many; all data local-only by default |
| FR-12 | Daily Story Engine | Generate exactly one personalized story/day from the day's activity summary (XP events, mood history, sessions) | Story generation is idempotent per calendar day (re-opening app doesn't regenerate); works fully offline via local template engine, optionally enhanced by configured AI provider |
| FR-13 | Achievement System | Defined achievement set with unlock rules evaluated on relevant events; badge + XP reward | Unlock evaluated exactly once per qualifying event batch (no duplicate unlocks); achievement list visible with locked/unlocked + progress where applicable |
| FR-14 | Rare Event Engine | Probability-weighted rare cosmetic/behavior events (Golden Cat, Ghost Cat, Ninja Cat) on a timed roll; user can capture a shareable screenshot | Roll cadence configurable (default: hourly while app active, weighted by engagement); probabilities sum to a documented total; screenshot saved locally on demand, never auto-shared |

## 3. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-01 | Performance | 60 FPS render; <5% CPU average idle; <200MB RAM (FR-01 budget); SQLite writes debounced/batched |
| NFR-02 | Reliability | App must not lose XP/session data on crash — every state-mutating service call is a single transactional DB write (no partial writes) |
| NFR-03 | Privacy | No data leaves device in Free tier; AI provider API keys stored in OS keychain, never plaintext |
| NFR-04 | Portability | Builds on Windows 10+, macOS 12+, Linux (X11 primary; Wayland degrades F09/F10 gracefully per Architecture §7) |
| NFR-05 | Testability | All business logic (XP formula, mood transitions, repeat-rule resolution, achievement rules, rare-event probability) implemented as pure functions/services, unit-testable without a running Tauri app |
| NFR-06 | Observability | Every event in PRD §13 Analytics Events list is emitted to PostHog with a typed payload schema (Section 6) |

## 4. Data Model (authoritative — mirrors `db/schema.sql`)

```yaml
entities:
  cat_state:
    attributes:
      - id: integer (pk, always = 1, single-row table for MVP single-profile)
      - personality: text enum [lazy, hyper, smart, clingy, tsundere]
      - level: integer (default 1)
      - xp_total: integer (default 0)
      - growth_stage: text enum [kitten, teen, adult, legendary] (derived, cached)
      - name: text (user-given name, used in reminder copy)
      - created_at, updated_at: timestamp

  xp_events:
    attributes:
      - id, source: text enum [pomodoro, reminder, focus_session, achievement, rare_event]
      - amount: integer
      - created_at: timestamp
    relationships: [contributes_to: cat_state]

  pomodoro_sessions:
    attributes:
      - id, phase: text enum [focus, break]
      - planned_seconds, actual_seconds: integer
      - status: text enum [running, paused, completed, abandoned]
      - started_at, ended_at: timestamp

  reminders:
    attributes:
      - id, title, body_template, repeat_rule: text enum [none, daily, weekly, custom]
      - repeat_payload: json (e.g. days-of-week for custom)
      - next_fire_at: timestamp
      - is_active: boolean

  ai_memory_entries:
    attributes:
      - id, kind: text enum [prompt, response, snippet]
      - content: text
      - source_provider: text nullable [openai, claude, gemini, ollama, manual]
      - created_at: timestamp
    relationships: [has_many: ai_memory_tags via join table]

  ai_memory_tags / ai_memory_entry_tags: many-to-many join

  achievements (static catalog, seeded) / achievement_unlocks (user progress):
    see schema.sql for full structure

  rare_event_log:
    attributes: [id, event_type, triggered_at, shared: boolean]

  daily_stories:
    attributes: [id, story_date (unique), content, generated_by: text]

  analytics_events:
    attributes: [id, event_name, payload_json, created_at]

  app_settings:
    key-value table: tier (free/pro), ai_provider_default, distraction_patterns(json), notification_prefs(json)
```

## 5. Command (IPC) Contract — Frontend <-> Rust

All commands return `Result<T, AppError>` serialized as `{ ok: true, data } | { ok: false, error }`.

```yaml
commands:
  cat_get_state: () -> CatState
  cat_set_personality: { personality } -> CatState
  cat_rename: { name } -> CatState

  xp_award: { source, amount? } -> { catState, leveledUp: bool }   # amount optional, defaults from XP table

  pomodoro_start: { phase, plannedSeconds } -> PomodoroSession
  pomodoro_pause: { sessionId } -> PomodoroSession
  pomodoro_resume: { sessionId } -> PomodoroSession
  pomodoro_complete: { sessionId } -> { session, xpAwarded }
  pomodoro_history: { from?, to? } -> PomodoroSession[]

  reminder_create / reminder_update / reminder_delete / reminder_list

  memory_save: { kind, content, sourceProvider?, tags? } -> AiMemoryEntry
  memory_search: { query, tags? } -> AiMemoryEntry[]
  memory_delete: { id }

  achievement_list: () -> AchievementWithProgress[]

  story_get_today: () -> DailyStory
  story_regenerate: () -> DailyStory   # Pro-only, manual override

  settings_get / settings_update

events_emitted:
  - xp:updated, level:up, mood:changed, achievement:unlocked
  - reminder:due, pomodoro:tick, focus:distraction_detected
  - ai:presence_detected, rare_event:triggered, story:ready
```

## 6. Analytics Event Schema (PRD §13)

Each event below is emitted with a minimal typed payload; full list implemented in `analytics_service`:

```
app_open {}                          app_close { sessionDurationSec }
focus_start { plannedSeconds }       focus_complete { actualSeconds, xpAwarded }
pomodoro_start { phase }             pomodoro_complete { phase, xpAwarded }
xp_earned { source, amount, total }  level_up { newLevel, growthStage }
achievement_unlocked { id, xpAwarded }
ai_detected { provider, confidence } ai_response_saved { kind }
personality_changed { from, to }     rare_event_triggered { eventType }
story_viewed { storyDate }           pet_interaction { type }  # drag, click, pet
```

## 7. Edge Cases & Exceptions (selected, see GitHub issues for full per-feature list)

- Pomodoro: app force-quit mid-session -> on relaunch, `status=running` sessions older than `planned_seconds*2` are auto-marked `abandoned`, no XP awarded.
- Reminder repeat rule across DST changes -> `next_fire_at` recomputed from wall-clock local time, not stored offset.
- Mood signals with no activity for >24h (app closed) -> mood resets to neutral baseline on next open rather than extrapolating "Lonely" indefinitely.
- AI Memory Vault search with empty query -> returns most-recent N, not empty set.
- Rare Event roll while app window is not focused -> still rolls (background tick), but visual reveal deferred until window regains focus.

## 8. Validation Checklist

- [x] Every PRD MVP feature (F01-F14) has at least one FR with testable AC
- [x] Every FR maps to a data model entity and/or command
- [x] Every PRD Analytics Event is in the schema
- [x] Performance, privacy, portability constraints stated as NFRs
- [x] Platform risk (F09/F10) called out with graceful-degradation requirement

## 9. Post-MVP Interface Stubs (not implemented, contract only)

```rust
trait CloudSyncProvider { async fn push(&self, since: Timestamp) -> Result<()>; async fn pull(&self) -> Result<()>; }
trait MarketplaceCatalog { async fn list_items(&self, category: &str) -> Result<Vec<CosmeticItem>>; }
trait AiCoach { async fn weekly_insight(&self, activity: &ActivitySummary) -> Result<String>; }
```
