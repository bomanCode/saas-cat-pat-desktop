# Production Checklist — Comnyang 2.0

Owner: production-validator (+ tester, performance-optimizer for their sections)
Status legend: ✅ done & verified · 🟡 implemented, unverified · ⬜ not started

This checklist gates a public release, not the MVP feature-complete milestone (see `docs/roadmap.md` for feature status). Nothing here should be marked ✅ without it actually having been run/checked on a real machine — this file has already been burned once by aspirational status claims; keep it honest.

## 1. Build & compile

- [ ] `cargo check` passes on a real machine (⬜ — **never run in this sandbox, no Rust toolchain available**; this is the single highest-priority unverified item in the entire repo)
- [ ] `cargo clippy --all-targets --all-features -- -D warnings` passes
- [ ] `cargo fmt --all -- --check` passes
- [ ] `cargo test --all-features` passes (tests are written — `src-tauri/src/services/*.rs`, `src-tauri/src/integrations/window_watcher.rs` — but unexecuted in this sandbox)
- [x] `npm run typecheck` passes (verified in sandbox)
- [x] `npm run test` passes — 22/22 (verified in sandbox)
- [x] `npm run build` (production Vite build) succeeds (verified in sandbox)
- [ ] `npm run tauri build` produces installers on Windows, macOS, Linux (⬜ requires a real machine per OS, or the CI release workflow)

## 2. Cross-platform manual QA (cannot be automated for most of this)

- [ ] **Windows**: pet window renders transparent/always-on-top correctly, tray icon + menu works, notifications fire, F09/F10 window watcher (`active-win-pos-rs`) returns real foreground app data
- [ ] **macOS**: same as above; additionally confirm Accessibility permission prompt appears and works for window watching (macOS requires this explicitly)
- [ ] **Linux (X11)**: same as above
- [ ] **Linux (Wayland)**: confirm F09/F10 degrade gracefully to "always returns None" (architecture.md §7 `NullWatcher`/no-op path) rather than crashing or spamming errors — this is a designed limitation, not a bug, but must be verified it actually degrades rather than panics
- [ ] Multi-monitor: eye-follow (F02) and pet window positioning behave sanely when the pet is dragged across monitor boundaries

## 3. Performance (F01 acceptance criteria — PRD-mandated, not optional)

- [ ] 60 FPS sustained, measured via Tauri devtools / browser profiler, idle and during drag
- [ ] CPU usage <5% average over a 10-minute idle window
- [ ] RAM usage <200MB
- [ ] Idle/unfocused throttle (`CatEngine`'s `IDLE_UNFOCUSED_FPS`) actually engages and actually reduces measured CPU — verify with a profiler, not just code inspection
- [ ] SQLite write volume under normal use doesn't cause I/O-driven jank (architecture.md §10) — check with the mood-log tick (every 15s) and analytics queue running for a full day

## 4. Data integrity & migrations

- [ ] Fresh install: `db::init_pool` creates the DB and runs `0001_init.sql` cleanly
- [ ] Upgrade path: define and test the process for adding `0002_*.sql` etc. once schema changes are needed post-launch (sqlx migrate handles this automatically, but it's never been exercised with >1 migration file)
- [ ] Crash recovery: kill the app mid-Pomodoro-session, relaunch, confirm `reconcile_stale_sessions` marks it `abandoned` with no XP awarded (unit-tested in `pomodoro_service.rs`; not yet verified by actually killing a running app)
- [ ] Backup/export: there is currently **no user-facing way to export or back up their SQLite data** before an uninstall or reinstall — decide if this ships before public release or is an explicit known-gap in release notes

## 5. Security

- [ ] `npm audit` — no high/critical vulnerabilities in frontend deps
- [ ] `cargo audit` — no high/critical vulnerabilities in Rust deps
- [ ] AI provider API keys confirmed to live only in OS keychain (`keyring` crate) — manually inspect the SQLite DB after setting a key to confirm it's absent (`integrations/ai_provider.rs` is designed this way; never independently verified by inspecting an actual DB file)
- [ ] Tauri `capabilities/main.json` permission set reviewed — confirm no broader-than-needed permissions (e.g. arbitrary shell exec) before shipping
- [ ] CSP in `tauri.conf.json` reviewed against the actual final list of external hosts the app calls (OpenAI/Anthropic/Google/Ollama/PostHog) — update if any provider endpoint changes

## 6. Code signing & OS trust

- [ ] **macOS**: Developer ID certificate + notarization configured (`APPLE_CERTIFICATE`, `APPLE_ID`, etc. — see `.github/workflows/release.yml` commented block). Without this, Gatekeeper blocks the app on first launch.
- [ ] **Windows**: Authenticode signing configured (`TAURI_SIGNING_PRIVATE_KEY`). Without this, SmartScreen flags the installer as unrecognized.
- [ ] **Linux**: no OS-level signing requirement, but consider GPG-signing release artifacts for users who care
- [ ] Until the above are done, release notes must clearly disclose installers are unsigned (already noted in `release.yml`'s draft release body — keep that disclosure until signing lands)

## 7. Privacy & compliance

- [ ] Privacy policy written and linked from the app (Settings panel currently has no such link) — required given PostHog analytics + optional AI provider calls
- [ ] Analytics (PostHog) — confirm it's genuinely opt-in/off-by-default per architecture.md §11, not just "no-ops without an API key" (current implementation: `POSTHOG_API_KEY` env var unset = no-op, which is opt-in by omission but isn't a user-facing toggle — consider adding one in Settings before release)
- [ ] AI provider calls (OpenAI/Claude/Gemini) send user content to third parties — confirm Settings UI discloses this clearly at the point a key is added, not just in docs
- [ ] Terms of Service drafted if/when Pro tier billing ships (not implemented yet — no Stripe/payment integration exists in this repo)

## 8. Monetization (Pro tier)

- [ ] No payment provider is integrated yet. `cat_state.tier` exists in the schema and is checked (`story_regenerate` is gated on it), but there is no flow to actually upgrade a user to `pro` — this is a hard gap, not a polish item, before any monetization claims in marketing
- [ ] Decide and implement: Stripe Checkout (web) + a license-key or Supabase-auth-linked entitlement check from the desktop app, or another mechanism

## 9. Auto-update

- [ ] Tauri's updater plugin is **not configured** in this repo. Without it, every release requires users to manually download and reinstall. Decide before public release whether this ships v1, or is an explicit known-gap.

## 10. Release process

- [x] `.github/workflows/ci.yml` — runs on every push/PR
- [x] `.github/workflows/release.yml` — tag-triggered, builds Windows/macOS/Linux, creates a **draft** GitHub Release (deliberately draft — a human reviews and publishes, never auto-published)
- [ ] First real run of the release workflow, on a real tag push, confirmed to produce working installers
- [ ] Versioning policy decided (semver assumed; `package.json` and `src-tauri/Cargo.toml`/`tauri.conf.json` versions must be bumped together — currently manual, consider a script)

## 11. Known gaps to disclose honestly in any release notes

- F09/F10 OS-level detection is unverified outside this sandbox; Wayland is degraded-by-design
- No payment/Pro-tier upgrade flow
- No auto-update
- No data export/backup
- AI provider calls are real HTTP implementations but not load-tested against live APIs
- Cloud Sync, Marketplace, AI Coach, Voice Interaction, Team Cats are out of scope (post-MVP, PRD §9)
