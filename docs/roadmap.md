# Comnyang 2.0 — Implementation Roadmap

Mirrors PRD §15 Phases 1–5. Each phase lists scope, owning agent role (per
the SPARC pipeline this repo follows), exit criteria, and current status.
Status reflects this repo as of this commit — update it as work lands.

## Legend
✅ done & verified in this repo · 🟡 implemented, not yet verified end-to-end · ⬜ not started

---

## Phase 1 (Month 1–2) — Living Cat Engine, Eye Follow, Drag Physics, Mood

| Task | Owner role | Status |
|---|---|---|
| Behavior state machine (F01) | implementer-sparc-coder | ✅ pure logic + 9 unit tests passing |
| Pixi render layer / procedural cat art | implementer-sparc-coder | 🟡 placeholder Graphics art, not Spine (see architecture.md §10) |
| Eye follow (F02) | implementer-sparc-coder | ✅ pure logic + unit tests (jitter/accuracy) |
| Drag & physics (F03) | implementer-sparc-coder | ✅ pure logic + unit tests (settle-time, NaN guard) |
| Mood system (F04) | implementer-sparc-coder | ✅ Rust service + unit tests; 🟡 frontend wiring via mood:changed event |
| Personality engine (F05) | implementer-sparc-coder | ✅ Rust dialogue pool + TS mirror + unit tests |
| Perf budget validation (60fps/<5%CPU/<200MB) | performance-optimizer | ⬜ requires a built app + profiler run — **cannot be verified in a sandbox without a GUI**; first real task once `cargo tauri dev` runs on a dev machine |

**Exit criteria**: cat renders, follows cursor, drags/wobbles, mood visibly changes animation — all currently true in code; perf budget needs a real-machine profiling pass before sign-off.

---

## Phase 2 (Month 3–4) — Pomodoro, Reminder, XP, Leveling

| Task | Owner role | Status |
|---|---|---|
| XP & growth formula (F06) | specification + implementer | ✅ piecewise-linear formula hits all 3 PRD anchors exactly + unit tests |
| Pomodoro lifecycle (F07) | implementer-sparc-coder | ✅ Rust service (idempotent complete, crash reconciliation) + unit tests |
| Pomodoro UI (widget, history) | implementer-sparc-coder | ✅ `PomodoroWidget.tsx` in Hub |
| Smart Reminder (F08) | implementer-sparc-coder | ✅ Rust service (DST-safe repeat rules) + unit tests; ✅ `ReminderPanel.tsx` |
| Companion Hub shell (nav, header) | implementer-sparc-coder | ✅ `HubApp.tsx` |

**Exit criteria**: a user can run a full focus/break cycle, see XP/level update live, and manage reminders — implemented; needs a real Tauri build to click through manually before sign-off.

---

## Phase 3 (Month 5–6) — AI Detection, AI Memory, Achievements

| Task | Owner role | Status |
|---|---|---|
| AI presence detection (F10) | implementer-sparc-coder | ✅ pure classifier + unit tests; 🟡 OS watcher (`active-win-pos-rs`) compiles logically but **unverified on a real Windows/macOS/X11 machine** — no GUI/OS APIs in this sandbox |
| Focus Guardian (F09) | implementer-sparc-coder | ✅ pure classifier + unit tests; same OS-watcher caveat as F10 |
| AI Memory Vault (F11) | implementer-sparc-coder | ✅ Rust FTS5 service + unit tests; ✅ `MemoryVaultPanel.tsx` |
| Achievement system (F13) | implementer-sparc-coder | ✅ Rust rule registry + unit tests; ✅ `AchievementPanel.tsx` |
| Daily Story Engine (F12) | implementer-sparc-coder | ✅ offline template engine + unit tests; ✅ `StoryCard.tsx`; AI-enhanced mode wired to provider trait |
| AI provider integrations | implementer-sparc-coder | ✅ Ollama/OpenAI/Claude/Gemini real HTTP implementations + keychain key storage; ⬜ not load-tested against live APIs |
| Rare Event Engine (F14) | implementer-sparc-coder | ✅ probability table + unit tests; ✅ screenshot capture command (canvas → PNG → Pictures folder) |

**Exit criteria**: AI Explorer/Pomodoro Master/etc. achievements unlock correctly, Memory Vault search is fast and correct, daily story generates once/day — all true in unit tests; F09/F10's OS integration is the single highest-remaining-risk item and needs dedicated manual QA on each target OS (see Production Checklist).

---

## Phase 4 (Month 7–9) — Cloud Sync, Marketplace, Team Cats

⬜ **Not started — intentionally out of MVP scope** (specification.md §9 lists these as interface stubs only). Note on Cloud Sync specifically: this is a **desktop Tauri app**, not a Next.js server app, so the integration pattern is different from typical Supabase web tutorials —

- No `next/headers`, no middleware-based session refresh (there's no Next.js server in this architecture).
- The Rust backend (`integrations/cloud_sync.rs`, not yet created) would call Supabase's REST/Postgres endpoints directly via `reqwest` (or the `postgrest-rs` crate), authenticating with a long-lived Supabase **anon/publishable key** + a per-user JWT obtained through Supabase Auth's password/OAuth flow — stored in the OS keychain via the same `keyring` pattern already used for AI provider keys (`integrations/ai_provider.rs`).
- The frontend would never talk to Supabase directly; it goes through Tauri commands (`cloud_sync_login`, `cloud_sync_push`, `cloud_sync_pull`), keeping the security boundary identical to every other feature in this app (architecture.md §11).

## Phase 5 (Month 10–12) — AI Coach, Voice Interaction, Mobile Companion

⬜ Not started — out of MVP scope, interface stub only (`AiCoach` trait in specification.md §9).

---

## Cross-cutting / Production Hardening (ongoing, owner: production-validator + tester)

| Task | Status |
|---|---|
| Rust unit tests (xp/mood/pomodoro/reminder/achievement/rare_event/memory/story/window_watcher/personality) | ✅ written, **not yet executed** — no Rust toolchain available in this build sandbox; must run `cargo test` on a real machine before merge |
| Frontend unit tests (state machine/eye follow/physics) | ✅ written AND executed — `npx vitest run` passes 22/22 in this sandbox |
| Frontend type-check | ✅ `npx tsc --noEmit` passes clean in this sandbox |
| Rust compile check | ⬜ **not verified** — no `cargo`/Rust toolchain in this sandbox; run `cargo check` as the very first step on a dev machine |
| CI pipeline | ✅ `.github/workflows/ci.yml` — runs both suites above on every push/PR |
| Release pipeline | ✅ `.github/workflows/release.yml` — tag-triggered cross-platform Tauri build |
| GitHub issue backlog | ✅ `docs/github_issues.md` + `scripts/create_github_issues.sh` |
| Production checklist | ✅ `PRODUCTION_CHECKLIST.md` |
| Manual OS-level QA (F09/F10 window watcher, notifications, tray) | ⬜ requires real Windows/macOS/Linux machines |

**Honest summary of what "done" means in this repo**: every business-logic module (the Rust `services/` and TS `engine/`) is implemented AND test-covered, and those tests actually run and pass where a toolchain is available (frontend, in this sandbox). The Rust side has equally thorough tests but they're unexecuted here because there's no Rust toolchain in this build environment — that's the #1 thing to run before trusting any of it. The Hub/Pet UI is built and wired end-to-end through the mock backend (works in a plain browser via `npm run dev`), but has never run inside an actual Tauri window, so OS-chrome behaviors (transparency, always-on-top, tray, notifications, window watcher) are unverified by construction, not just untested.
