# Comnyang 2.0 — AI Productivity Companion

A desktop cat companion (Tauri v2 + Rust + React/PixiJS) that lives on your desktop, learns your work rhythm, and grows with you: Pomodoro focus sessions, smart reminders, an AI memory vault, achievements, daily stories, and rare events.

> **Status:** active MVP build. See [`docs/roadmap.md`](docs/roadmap.md) for what's done vs. in progress, and [`docs/architecture.md`](docs/architecture.md) / [`docs/specification.md`](docs/specification.md) for the full design.

## Tech stack

| Layer | Choice |
|---|---|
| Desktop runtime | Tauri v2 (Rust) |
| Frontend | React 18 + TypeScript + Vite |
| Rendering | PixiJS v8 (procedural cat engine — see `src/engine/`) |
| State | Zustand |
| Database | SQLite (`sqlx`, migrations in `db/migrations/`) |
| AI providers | OpenAI / Anthropic Claude / Google Gemini / Ollama (local default) |
| Cloud Sync (post-MVP) | Supabase + Vercel Functions (planned — see roadmap) |

## Prerequisites

- Node.js 18+ and npm
- Rust (stable) + `cargo` — see [Tauri's prerequisites guide](https://v2.tauri.app/start/prerequisites/) for OS-specific system dependencies (webkit2gtk on Linux, Xcode CLT on macOS, MSVC Build Tools on Windows)
- (Optional, for AI features) [Ollama](https://ollama.com) running locally, or an API key for OpenAI/Claude/Gemini

## Getting started

```bash
npm install
npm run tauri dev
```

This launches the Vite dev server and the Tauri desktop shell together. The pet window opens by default; the Companion Hub opens from the system tray icon.

### Frontend only (no Rust backend)

`src/lib/tauri.ts` falls back to an in-memory mock backend whenever the app isn't running inside Tauri, so you can iterate on UI in a plain browser:

```bash
npm run dev
```

## Testing

```bash
npm run typecheck     # tsc --noEmit
npm run test          # vitest — pure engine/state-machine/physics logic
cd src-tauri && cargo test   # Rust unit tests — services, repeat-rule resolution, XP formula, etc.
```

Rust tests use an in-memory SQLite pool (`db::init_test_pool`), so they don't touch your real app data and don't require a display/GUI.

## Building for production

```bash
npm run tauri build
```

Produces platform-native installers (`.msi`/`.exe` on Windows, `.dmg`/`.app` on macOS, `.deb`/`.AppImage` on Linux) in `src-tauri/target/release/bundle/`. See [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md) before shipping a release.

## Project structure

```
src/                  React + PixiJS frontend
  engine/             F01-F03: pure, unit-tested cat behavior/eye-follow/physics logic + Pixi render layer
  components/         Pet window + Companion Hub UI
  state/              Zustand stores (one per bounded context)
  lib/tauri.ts         Typed IPC client (+ in-browser mock for UI dev)
src-tauri/            Rust backend
  src/services/       Business logic (XP, mood, pomodoro, reminders, achievements, ...) — Tauri-independent, unit-tested
  src/commands/       Thin Tauri IPC handlers
  src/integrations/   Window watcher (F09/F10), notifications, AI provider adapters
db/                   SQLite schema + sqlx migrations
docs/                 Architecture, specification, roadmap, GitHub issue backlog
scripts/              Repo automation (e.g. bulk-creating GitHub issues from docs/github_issues.md)
```

## Environment variables

Only needed for optional features — the app runs fully offline without any of these.

| Variable | Used for |
|---|---|
| `POSTHOG_API_KEY`, `POSTHOG_HOST` | Analytics (Rust-side flush loop; no-ops if unset) |
| `COMNYANG_RARE_EVENT_INTERVAL_SECS` | Override the F14 rare-event roll cadence for QA (default: 3600) |

AI provider API keys (OpenAI/Claude/Gemini) are stored in the OS keychain via the `keyring` crate, not as environment variables — set them from the Settings panel in the Companion Hub.

## License

TBD — add your chosen license here before public release.
