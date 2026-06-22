# Comnyang 2.0 — GitHub Issue Backlog

Machine-parseable by `scripts/create_github_issues.sh` (splits on the
`---ISSUE-END---` delimiter) to bulk-create these via `gh issue create`.
Editing this file is the source of truth — re-run the script after edits;
it's safe to re-run (gh will just create duplicates if run twice, so the
script checks existing titles first — see script comments).

Format per issue:
```
### <title>
LABELS: <comma-separated>
MILESTONE: <phase name>
BODY:
<markdown — first line after BODY: through the delimiter>
---ISSUE-END---
```

---

### Project setup: Tauri v2 + React + TS + Zustand + PixiJS scaffold
LABELS: setup, infra
MILESTONE: Phase 0 — Foundation
BODY:
Initialize the monorepo per `docs/architecture.md`: Tauri v2 project (`src-tauri/`), Vite+React+TS frontend (`src/`), SQLite migrations (`db/migrations/`).

**Acceptance criteria**
- [ ] `cargo check` passes in `src-tauri/`
- [ ] `npm run typecheck` passes
- [ ] `npm run dev` + `cargo tauri dev` launches a transparent always-on-top pet window
- [ ] CI (`ci.yml`) green on a clean clone
---ISSUE-END---

### F01 — Living Cat Engine
LABELS: feature, engine, F01
MILESTONE: Phase 1 — Engine Core
BODY:
Implement the behavior state machine (idle/sleeping/walking/watching_cursor/sitting/grooming) and Pixi render layer.

**Acceptance criteria** (spec FR-01)
- [ ] 60 FPS sustained on target hardware
- [ ] CPU <5% average over 10 min idle (measured with the OS's own profiler, not just devtools)
- [ ] RAM <200MB
- [ ] All 6 states reachable in the automated state-machine test (`stateMachine.test.ts`)

**Status**: state machine + procedural placeholder art implemented and unit-tested (`src/engine/behaviors/stateMachine.ts`). Perf budget NOT yet measured on real hardware — do this before closing.
---ISSUE-END---

### F02 — Eye Follow System
LABELS: feature, engine, F02
MILESTONE: Phase 1 — Engine Core
BODY:
Pupils track cursor position with smoothing, clamped to the eye socket.

**Acceptance criteria** (spec FR-02)
- [ ] No visible jitter
- [ ] Angular accuracy >95% vs. true cursor vector
- [ ] Works across multi-monitor setups (needs manual verification — multi-monitor cursor coordinates aren't simulated in unit tests)

**Status**: implemented + unit tested (`src/engine/eyeFollow.ts`). Multi-monitor behavior unverified — no multi-display environment in CI.
---ISSUE-END---

### F03 — Drag & Physics
LABELS: feature, engine, F03
MILESTONE: Phase 1 — Engine Core
BODY:
Draggable body with stretch + wobble spring physics.

**Acceptance criteria** (spec FR-03)
- [ ] Stretch capped to configurable max
- [ ] Wobble decays to rest within 1.5s
- [ ] No NaN/Infinity under pathological input (extreme drag distance, huge/negative dt)

**Status**: implemented + unit tested (`src/engine/physics/dragPhysics.ts`), including the NaN-guard and settle-time assertions directly in tests.
---ISSUE-END---

### F04 — Mood System
LABELS: feature, backend, F04
MILESTONE: Phase 1 — Engine Core
BODY:
Mood (Happy/Focused/Sleepy/Curious/Hungry/Lonely) derived from activity/time/interaction signals.

**Acceptance criteria** (spec FR-04)
- [ ] Mood transitions automatically without explicit user action
- [ ] Mood visibly changes animation set
- [ ] Debug overlay exposes current mood for QA

**Status**: pure `compute_mood` implemented + unit tested in Rust (`services/mood_service.rs`). Background loop pushes `mood:changed` events (`lib.rs::spawn_mood_loop`). Debug overlay UI not yet built — add a small dev-only badge in `CatStage.tsx`.
---ISSUE-END---

### F05 — Personality Engine
LABELS: feature, backend, F05
MILESTONE: Phase 1 — Engine Core
BODY:
5 personality types bias dialogue line selection.

**Acceptance criteria** (spec FR-05)
- [ ] Personality persists across restarts
- [ ] Dialogue selection provably biased by personality (seeded-RNG testable)

**Status**: done both server-side (`services/personality_service.rs`, seeded `StdRng` test asserts ~66% match-rate) and client-side cosmetic mirror (`engine/dialogue.ts`, seeded `mulberry32`).
---ISSUE-END---

### F06 — XP & Growth System
LABELS: feature, backend, F06
MILESTONE: Phase 2 — Productivity Loop
BODY:
XP accrual, leveling formula, growth-stage bands.

**Acceptance criteria** (spec FR-06)
- [ ] Formula matches PRD anchors exactly: L1=100XP, L10=1000XP, L50=10000XP
- [ ] Level-up fires exactly once per threshold crossing
- [ ] Atomic award (ledger insert + state update in one transaction)

**Status**: done. See `services/xp_service.rs` module doc for why a piecewise-linear formula (not a single power law) was required to hit all three PRD anchors exactly — the three points are not collinear under any `a*L^b`.
---ISSUE-END---

### F07 — Pomodoro Focus Mode
LABELS: feature, backend, frontend, F07
MILESTONE: Phase 2 — Productivity Loop
BODY:
Focus/break timer, pause/resume, history, XP reward.

**Acceptance criteria** (spec FR-07)
- [ ] Floating widget always accessible
- [ ] History queryable by date range
- [ ] XP awarded exactly once per session even across app crash/restart

**Status**: backend service + idempotency + crash-reconciliation done and unit tested (`services/pomodoro_service.rs`). `PomodoroWidget.tsx` built in the Hub. Needs real end-to-end click-through once a Tauri build runs.
---ISSUE-END---

### F08 — Smart Reminder
LABELS: feature, backend, frontend, F08
MILESTONE: Phase 2 — Productivity Loop
BODY:
CRUD reminders with repeat rules and personality-flavored copy.

**Acceptance criteria** (spec FR-08)
- [ ] Fires within ±5s of schedule
- [ ] Repeat rule reschedules correctly across DST
- [ ] Delete cancels pending notification

**Status**: backend done with DST-safe wall-clock rescheduling, unit tested (`services/reminder_service.rs`). `ReminderPanel.tsx` built. Native OS notification firing (`tauri-plugin-notification`) unverified outside a real OS.
---ISSUE-END---

### F09 — Focus Guardian
LABELS: feature, backend, platform-risk, F09
MILESTONE: Phase 3 — AI & Achievements
BODY:
Detect distraction apps during an active focus session; non-blocking nudge.

**Acceptance criteria** (spec FR-09)
- [ ] Nudge within 3s of distraction app gaining focus
- [ ] Never blocks user activity
- [ ] Degrades gracefully on platforms without window-watch support (Wayland)

**Status**: pure classifier (`is_distraction`) implemented + unit tested. `ActiveWinWatcher` (via `active-win-pos-rs`) + `NullWatcher` fallback implemented per architecture.md §7. **Not run on a real OS** — this is the single highest-risk unverified surface in the codebase; prioritize manual QA on Windows/macOS/Linux X11 before shipping.
---ISSUE-END---

### F10 — AI Presence Detection
LABELS: feature, backend, platform-risk, F10
MILESTONE: Phase 3 — AI & Achievements
BODY:
Detect ChatGPT/Claude/Gemini in foreground; trigger thinking/waiting/celebration animation cues.

**Acceptance criteria** (spec FR-10)
- [ ] Detection precision >90% on a labeled window-title/process-name test set
- [ ] False-positive rate tracked, capped <10%

**Status**: pure classifier (`detect_ai_tool`) implemented + unit tested with a small labeled set in `window_watcher.rs` tests. **Needs a larger labeled dataset** (real-world window titles across browsers/OSes) before the >90% precision claim can be measured for real — current tests only prove the matching logic is correct, not that it generalizes.
---ISSUE-END---

### F11 — AI Memory Vault
LABELS: feature, backend, frontend, F11
MILESTONE: Phase 3 — AI & Achievements
BODY:
Save/bookmark prompts/responses/snippets; tag; full-text search.

**Acceptance criteria** (spec FR-11)
- [ ] Search <200ms @ 10k rows
- [ ] Tags many-to-many
- [ ] Local-only by default

**Status**: FTS5-backed search implemented + unit tested (`services/memory_service.rs`). `MemoryVaultPanel.tsx` built (search, tag filter, save form, list). 10k-row latency not load-tested — add a seed-data benchmark before sign-off.
---ISSUE-END---

### F12 — Daily Story Engine
LABELS: feature, backend, frontend, F12
MILESTONE: Phase 3 — AI & Achievements
BODY:
One personalized story/day from activity summary; offline template engine, optional AI enhancement.

**Acceptance criteria** (spec FR-12)
- [ ] Idempotent per calendar day
- [ ] Works fully offline

**Status**: done + unit tested (`services/story_service.rs`). `StoryCard.tsx` built with Pro-gated regenerate. AI-enhanced rewording (via `AiProvider`) is wired at the trait level but not yet called from `story_service` — currently always template-only; follow-up task to actually invoke the provider when configured.
---ISSUE-END---

### F13 — Achievement System
LABELS: feature, backend, frontend, F13
MILESTONE: Phase 3 — AI & Achievements
BODY:
5 MVP achievements, rule-based unlock evaluation, badge + XP.

**Acceptance criteria** (spec FR-13)
- [ ] Unlock evaluated exactly once per qualifying event (no duplicate unlocks/XP)
- [ ] List shows locked/unlocked + progress

**Status**: done + unit tested (`services/achievement_service.rs`, including a duplicate-evaluation test). `AchievementPanel.tsx` built with unlock toast.
---ISSUE-END---

### F14 — Rare Event Engine
LABELS: feature, backend, frontend, F14
MILESTONE: Phase 3 — AI & Achievements
BODY:
Probability-weighted rare events (Golden/Ghost/Ninja Cat); shareable screenshot.

**Acceptance criteria** (spec FR-14)
- [ ] Documented, tested probability table
- [ ] Screenshot saved locally on demand, never auto-shared

**Status**: probability table + unit tests done (`services/rare_event_service.rs`). Screenshot capture implemented end-to-end: `CatStage.tsx` grabs the Pixi canvas via `canvas.toDataURL`, sends base64 to `rare_event_capture_screenshot` Rust command, which decodes and writes to `Pictures/Comnyang/`. **Current MVP cat art has no distinct Golden/Ghost/Ninja visual variant yet** — rare events fire and log correctly but don't yet change the cat's appearance; follow-up task to add cosmetic overlays per event type.
---ISSUE-END---

### AI Provider integrations (OpenAI/Claude/Gemini/Ollama)
LABELS: feature, backend, ai
MILESTONE: Phase 3 — AI & Achievements
BODY:
Real HTTP adapters behind the `AiProvider` trait, OS-keychain key storage.

**Acceptance criteria**
- [ ] Ollama works with zero configuration (local, no key)
- [ ] OpenAI/Claude/Gemini work once a key is stored via Settings
- [ ] Keys never touch SQLite or plaintext config

**Status**: all four implemented in `integrations/ai_provider.rs` with real endpoints. **Not load-tested against live APIs** — verify each adapter against the real endpoint (response shape can drift) before relying on it in production.
---ISSUE-END---

### Companion Hub — dashboard shell, navigation, cat header
LABELS: feature, frontend, hub
MILESTONE: Phase 2 — Productivity Loop
BODY:
The standard (non-transparent) window housing Pomodoro/Reminder/Memory/Achievements/Story/Settings.

**Acceptance criteria**
- [ ] Tab navigation between all 6 panels
- [ ] Header shows cat name, level, XP progress bar, mood
- [ ] Opens from tray "Open Hub" and from double-clicking the pet

**Status**: done — `HubApp.tsx`, second `hub` window added to `tauri.conf.json`, tray emits `tray:open_hub` which the Hub window listens for to bring itself to front.
---ISSUE-END---

### Pet window — cross-feature reaction integration
LABELS: feature, frontend, integration
MILESTONE: Phase 2 — Productivity Loop
BODY:
Wire reminder/achievement/AI-detection/focus-nudge/rare-event events into visible speech-bubble reactions on the pet itself, not just in the Hub.

**Acceptance criteria**
- [ ] Reminder fire shows personality-flavored text on the pet
- [ ] Achievement unlock shows a toast on the pet
- [ ] Focus Guardian nudge appears as a speech bubble, not a modal
- [ ] Rare event shows a sparkle + screenshot affordance

**Status**: done via `SpeechBubble.tsx` + event wiring in `CatStage.tsx`.
---ISSUE-END---

### Performance budget validation on real hardware
LABELS: perf, qa
MILESTONE: Production Hardening
BODY:
Measure actual FPS/CPU/RAM against F01's acceptance criteria using OS-native tools (Task Manager / Activity Monitor / `top`), not just browser devtools.

**Acceptance criteria**
- [ ] 60fps sustained, logged over a 10-minute idle session
- [ ] <5% average CPU over the same session
- [ ] <200MB RAM steady-state

**Status**: NOT started — requires a real built app on real hardware; impossible to verify in this build sandbox (no GUI).
---ISSUE-END---

### Manual OS QA pass — Windows / macOS / Linux
LABELS: qa, platform-risk
MILESTONE: Production Hardening
BODY:
Click through every feature on each target OS, with special attention to F09/F10 (window watcher), notifications, tray, and transparent always-on-top window behavior.

**Acceptance criteria**
- [ ] Window watcher returns real foreground app data on Windows, macOS, Linux X11
- [ ] Window watcher degrades to no-op (not a crash) on Wayland
- [ ] Notifications fire natively on each OS
- [ ] Tray icon + menu work on each OS

**Status**: NOT started — no GUI/OS APIs available in this build sandbox.
---ISSUE-END---

### Rust toolchain verification (cargo check / cargo test / clippy)
LABELS: ci, qa
MILESTONE: Production Hardening
BODY:
Run the full Rust test suite written across `services/` and `integrations/` against a real toolchain — this sandbox has no `cargo`/`rustc` installed, so none of the ~25 `#[test]` functions written in this codebase have actually been executed yet, only reviewed.

**Acceptance criteria**
- [ ] `cargo check` passes with zero errors
- [ ] `cargo test` — all tests pass
- [ ] `cargo clippy -- -D warnings` passes

**Status**: NOT executed in this environment. This is the single most important task to run before trusting any Rust code in this repository — the CI workflow runs it automatically going forward, but the current commit has never been compiled.
---ISSUE-END---

### CI pipeline
LABELS: ci, infra
MILESTONE: Production Hardening
BODY:
GitHub Actions workflow running Rust + frontend checks on every push/PR.

**Acceptance criteria**
- [ ] `cargo check` + `cargo test` + `cargo clippy`
- [ ] `npm run typecheck` + `npm run test` + `npm run build`
- [ ] Fails the PR check on any failure

**Status**: done — `.github/workflows/ci.yml`.
---ISSUE-END---

### Release pipeline
LABELS: cd, infra
MILESTONE: Production Hardening
BODY:
Tag-triggered cross-platform build producing signed/unsigned installers for Windows/macOS/Linux via `tauri-action`.

**Acceptance criteria**
- [ ] Pushing a `v*` tag builds all 3 platforms
- [ ] Artifacts attached to a GitHub Release
- [ ] Code-signing documented as a follow-up (requires paid certs — not configured by default)

**Status**: done — `.github/workflows/release.yml`. Code signing intentionally left unconfigured (needs the maintainer's own certificates/secrets).
---ISSUE-END---

### Privacy & security review
LABELS: security, qa
MILESTONE: Production Hardening
BODY:
Verify NFR-03 in practice: no Free-tier data leaves the device, API keys never hit SQLite/logs, CSP is correctly scoped.

**Acceptance criteria**
- [ ] Grep the SQLite DB file for any plaintext API key after configuring all 3 hosted AI providers
- [ ] Confirm `tauri.conf.json` CSP blocks any origin not explicitly listed
- [ ] Confirm analytics queue never includes AI Memory Vault content
---ISSUE-END---

### Post-MVP: Cloud Sync (Supabase)
LABELS: post-mvp, backlog
MILESTONE: Phase 4 — Cloud & Marketplace
BODY:
Implement `CloudSyncProvider` trait against Supabase via direct REST/Postgres calls from Rust (NOT via `@supabase/ssr`/Next.js patterns — this is a desktop app, see `docs/roadmap.md` Phase 4 note). Auth token stored in OS keychain.
---ISSUE-END---

### Post-MVP: Marketplace (skins/accessories)
LABELS: post-mvp, backlog
MILESTONE: Phase 4 — Cloud & Marketplace
BODY:
Implement `MarketplaceCatalog` trait + storefront UI + purchase flow (likely Stripe, needs its own spec pass).
---ISSUE-END---

### Post-MVP: AI Coach
LABELS: post-mvp, backlog
MILESTONE: Phase 5 — Coach & Voice
BODY:
Implement `AiCoach` trait: weekly productivity insight generated from `ActivitySummary`, surfaced in the Hub.
---ISSUE-END---

### Post-MVP: Voice Interaction
LABELS: post-mvp, backlog
MILESTONE: Phase 5 — Coach & Voice
BODY:
Speech-to-text input + TTS responses from the cat. Needs a spec pass on which STT/TTS provider (on-device vs. cloud) before implementation.
---ISSUE-END---

### Post-MVP: Team Cats
LABELS: post-mvp, backlog
MILESTONE: Phase 4 — Cloud & Marketplace
BODY:
Multiplayer presence — see teammates' cats/progress. Depends on Cloud Sync shipping first.
---ISSUE-END---
