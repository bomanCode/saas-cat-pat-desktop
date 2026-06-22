# Comnyang 2.0 — System Architecture

Status: Approved for MVP build
Owner: Architecture phase (agent-architecture / agent-arch-system-design)

## 1. Architectural Goals

| Goal | Driver |
|---|---|
| 60 FPS render, <5% CPU idle, <200MB RAM | F01 acceptance criteria |
| Offline-first, local data ownership | Free tier has no cloud dependency |
| Pluggable AI layer (OpenAI/Claude/Gemini/Ollama) | F10/F12, avoids vendor lock-in |
| Clear boundary between "engine" (render/physics/behavior) and "brain" (state/persistence/business logic) | Independent testability, perf isolation |
| OS-level features (window detection, notifications) isolated behind a trait/interface | F09/F10 are the highest platform-risk surface; must not block the rest of the app if a platform impl is missing |

## 2. High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Tauri v2 Shell (Rust)                    │
│                                                                   │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐    │
│  │  Commands      │  │  Services      │  │  Integrations      │    │
│  │  (IPC surface) │  │  - XP/Level    │  │  - Window watcher  │    │
│  │                │  │  - Mood        │  │    (F09/F10)       │    │
│  │  cat_*         │  │  - Pomodoro    │  │  - Notifier        │    │
│  │  pomodoro_*    │  │  - Reminder    │  │  - AI providers     │    │
│  │  reminder_*    │  │  - Achievement │  │    (OpenAI/Claude/  │    │
│  │  memory_*      │  │  - RareEvent   │  │     Gemini/Ollama)  │    │
│  │  achievement_* │  │  - Story gen   │  │  - Screenshot       │    │
│  │  story_*       │  │                │  │                     │    │
│  │  ai_*          │  └───────┬───────┘  └─────────┬───────────┘    │
│  └───────┬───────┘          │                     │                │
│          │           ┌──────▼─────────────────────▼──────┐         │
│          └──────────►│           db (SQLite, sqlx)        │         │
│                      └────────────────────────────────────┘         │
│                                  ▲                                  │
│                          Tauri Events (push)                       │
└──────────────────────────────────┬──────────────────────────────────┘
                                    │ IPC (invoke / emit / listen)
┌──────────────────────────────────▼──────────────────────────────────┐
│                      React + TypeScript Frontend                     │
│                                                                       │
│  ┌────────────────┐   ┌──────────────────┐   ┌────────────────────┐ │
│  │  Engine layer   │   │  State (Zustand)  │   │  UI components      │ │
│  │  (PixiJS)       │◄──┤  - catStore        │──►│  - PomodoroWidget   │ │
│  │  - CatRenderer  │   │  - moodStore       │   │  - ReminderPanel    │ │
│  │  - StateMachine │   │  - xpStore         │   │  - MemoryVaultUI    │ │
│  │  - EyeFollow    │   │  - settingsStore   │   │  - AchievementToast │ │
│  │  - DragPhysics  │   │  - sessionStore    │   │  - StoryCard        │ │
│  └────────────────┘   └──────────────────┘   └────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

## 3. Process & Window Model

Tauri v2 always-on-top transparent overlay window (the cat) + a secondary standard window (the "Companion Hub" — Pomodoro details, Memory Vault, Achievements, Settings). Two windows share the same Rust backend and SQLite connection pool; the frontend is one Vite app with route-based entry (`?window=pet` vs `?window=hub`) to keep a single build pipeline.

- **Pet window**: transparent, click-through except on the cat hitbox, `alwaysOnTop`, `decorations:false`, `skipTaskbar:true`.
- **Hub window**: normal window, opened on tray-icon click or cat double-click.
- **System tray**: quick actions (Start Focus, Open Hub, Quit), reflects current mood as an icon variant.

## 4. Engine Layer (Frontend, PixiJS)

The engine is a deterministic state machine independent of React's render cycle — React only mounts/unmounts the Pixi `Application` and reflects state for UI overlays (speech bubbles, mood icon). This is critical for the 60 FPS / <5% CPU budget: Pixi's own ticker drives animation, not React re-renders.

```
CatEngine
 ├─ Stage (Pixi.Application, transparent, resizes to window)
 ├─ BehaviorStateMachine   (F01)
 │   states: idle, sleeping, walking, watching_cursor, sitting, grooming
 │   transitions driven by: MoodStore, idle timer, cursor proximity, drag events
 ├─ EyeFollowController    (F02)
 │   lerp(pupil, cursorVector, smoothing) each tick, clamped to eye socket radius
 ├─ DragPhysicsController  (F03)
 │   pointer events -> spring/verlet model -> stretch + wobble + squash
 ├─ MoodController         (F04)
 │   consumes signals (activity, time-of-day, interaction freq) -> mood enum
 │   mood modifies: animation speed, idle threshold, dialogue pool
 ├─ PersonalityController  (F05)
 │   static trait (chosen at onboarding or unlocked) -> dialogue bias + reaction weights
 └─ DialogueBubble         (renders lines from Personality+Mood+Context)
```

State machine transition table (F01) — single source of truth, unit-testable in isolation from Pixi:

| Current | Event | Next | Notes |
|---|---|---|---|
| idle | idleTimeout(>20s) | sitting/grooming (random, mood-weighted) | |
| idle | cursorNear | watching_cursor | |
| any (not dragging) | dragStart | (suspended, physics takes over) | |
| dragging | dragEnd | idle | with land/wobble animation |
| watching_cursor | cursorFar(>3s) | idle | |
| idle | mood=sleepy & idleTimeout(>60s) | sleeping | |
| sleeping | userActivity | idle (waking animation) | |
| any | focusSessionStart | focused (visual variant of idle/sitting) | |

## 5. State Management (Frontend)

Zustand stores, one per bounded context, each backed by a Tauri command for persistence (no direct SQLite access from frontend — all writes go through Rust commands for single-writer integrity):

- `catStore`: level, xp, growthStage, personality
- `moodStore`: current mood, contributing signals (ephemeral, not persisted)
- `pomodoroStore`: session phase, remaining time, history cache
- `reminderStore`: CRUD cache, next-due reminder
- `memoryVaultStore`: entries cache, search/filter state
- `achievementStore`: unlocked set, progress counters
- `settingsStore`: tier (free/pro), personality lock state, notification prefs

Each store subscribes to a matching Tauri event (`xp:updated`, `mood:changed`, `reminder:due`, etc.) so the Rust side remains the source of truth and multiple windows stay in sync.

## 6. Backend Layer (Rust / Tauri v2)

```
src-tauri/src/
 ├─ main.rs              # app builder, plugin registration, tray, window setup
 ├─ db/
 │   ├─ mod.rs           # pool init, migration runner
 │   └─ models.rs        # row structs (sqlx::FromRow)
 ├─ commands/            # #[tauri::command] thin handlers -> services
 │   ├─ cat.rs  pomodoro.rs  reminder.rs  memory.rs
 │   ├─ achievement.rs  story.rs  rare_event.rs  ai.rs
 ├─ services/            # business logic, pure of Tauri types where possible
 │   ├─ xp_service.rs        (F06 — XP/level formula)
 │   ├─ mood_service.rs      (F04)
 │   ├─ pomodoro_service.rs  (F07)
 │   ├─ reminder_service.rs  (F08)
 │   ├─ achievement_service.rs (F13)
 │   ├─ rare_event_service.rs  (F14)
 │   └─ story_service.rs       (F12)
 └─ integrations/
     ├─ window_watcher.rs  (F09/F10 — active window/process polling, trait-based per-OS)
     ├─ notifier.rs        (tauri-plugin-notification wrapper)
     └─ ai_provider.rs     (OpenAI/Claude/Gemini/Ollama adapter trait)
```

**Why services are separate from commands**: commands are Tauri-coupled (they take `tauri::State`, `AppHandle`) and are hard to unit test directly. Services take plain structs/connections and return plain Results, so `agent-tester` can test business logic (XP math, mood transitions, streak/repeat-rule resolution) without spinning up a Tauri runtime.

## 7. The Highest-Risk Surface: F09 Focus Guardian & F10 AI Presence Detection

Both require enumerating the foreground window/process, which is OS-specific (Win32 `GetForegroundWindow`, macOS `NSWorkspace` + Accessibility permission, Linux X11/Wayland — Wayland has no standard API for this, which is a known constraint to disclose to users on Linux).

Architecture mitigates platform risk with a trait:

```rust
pub trait WindowWatcher: Send + Sync {
    fn foreground_app(&self) -> Option<ForegroundApp>; // process name + window title
}
```

Per-OS implementations live behind `cfg(target_os = ...)`. A `NullWatcher` (always returns `None`) is the fallback on unsupported platforms (e.g. Wayland) so the rest of the app degrades gracefully instead of crashing — F09/F10 simply become inactive with a Settings notice, rather than blocking ship.

Detection logic (distraction sites for F09, AI tool detection for F10) is a pure function over `ForegroundApp { process_name, window_title }` matched against a configurable pattern list stored in `app_settings` — this keeps the match rules data-driven and updatable without a recompile.

## 8. Data Flow Example (Pomodoro complete -> XP -> Level up -> Achievement)

1. Frontend `pomodoroStore` reaches 0 -> calls `invoke('pomodoro_complete', { sessionId })`
2. `commands::pomodoro::complete` -> `pomodoro_service::complete_session` writes session row, status=completed
3. Service calls `xp_service::award(source: PomodoroComplete)` -> inserts `xp_events` row, recalculates level via formula (Section 10 of PRD), updates `cat_state`
4. If level boundary crossed -> emits `level_up` event + records analytics event
5. `achievement_service::evaluate()` checks rules (e.g. "Pomodoro Master" = 50 completed sessions) -> unlocks if satisfied, awards bonus XP, emits `achievement_unlocked`
6. Rust emits all events via `app_handle.emit("xp:updated", payload)`—frontend stores update reactively in both Pet and Hub windows
7. `rare_event_service` rolls probability on a cadence (not only on Pomodoro complete) and may independently emit `rare_event_triggered`

## 9. AI Layer Abstraction

```rust
pub trait AiProvider {
    async fn complete(&self, prompt: &str, ctx: AiContext) -> Result<AiResponse>;
}
```

Implementations: `OpenAiProvider`, `ClaudeProvider`, `GeminiProvider`, `OllamaProvider` (local, no API key, used as the default/free-tier fallback for Daily Story generation so the feature works with zero configuration). User-supplied API keys are stored OS-keychain-backed (`tauri-plugin-stronghold` or `keyring` crate), never in SQLite plaintext.

F10 "AI Presence Detection" is unrelated to this trait — it detects the *user* using ChatGPT/Claude/Gemini in their browser/desktop app via the window watcher, it does not call those services.

## 10. Performance Budget Enforcement (ties to F01 AC: 60fps, <5% CPU, <200MB RAM)

- Pixi `Application` created with `antialias:false`, `resolution: window.devicePixelRatio`, capped via `autoDensity`; ticker throttled to skip work when `idle` state and window unfocused (reduce to 10fps when not hovered/focused, restore to 60fps on interaction).
- All sprite art uses texture atlases (single draw call per cat) — Spine runtime deferred to post-prototype; MVP ships with a Pixi `Graphics`/sprite-sheet fallback renderer behind the same `Renderer` interface so swapping in Spine later doesn't change the state machine.
- SQLite writes are batched/debounced (e.g. mood signal ticks aggregate client-side, only persisted state-changes hit disk) to avoid I/O-driven jank.
- `agent-performance-optimizer` owns a perf budget test (see `docs/roadmap.md` Phase 1 exit criteria) run via Tauri's devtools profiler + `tracing` spans in Rust services.

## 11. Security & Privacy

- All MVP data local-only (SQLite at `$APPDATA/comnyang/comnyang.db`).
- AI Memory Vault content never leaves device unless user explicitly enables Cloud Sync (post-MVP, Supabase, opt-in, row-level security keyed by auth.uid()).
- API keys for AI providers stored via OS keychain, not in the SQLite db or plaintext config.
- Screenshot capture (F14 shareable rare events) only writes to a user-chosen/Pictures folder, never auto-uploads.

## 12. Tech Stack (per PRD §12, pinned)

| Layer | Choice |
|---|---|
| Runtime | Tauri v2, Rust (stable, 2021 edition) |
| Frontend | React 18 + TypeScript 5, Vite |
| State | Zustand |
| Rendering | PixiJS v8 |
| DB | SQLite via `sqlx` (compile-time checked queries) |
| Cloud (post-MVP) | Supabase |
| AI | OpenAI / Anthropic / Gemini SDKs + Ollama (local HTTP) |
| Analytics | PostHog (Rust backend posts events; see `docs/specification.md` §Analytics) |
| Notifications | `tauri-plugin-notification` |
| Secrets | `keyring` crate (OS keychain) |
