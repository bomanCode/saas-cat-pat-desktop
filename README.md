# Comnyang 2.0 🐱

**AI Desktop Productivity Companion** — Tauri v2 + Rust + React + PixiJS

---

## ⚡ Quick Start

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 24.x | https://nodejs.org |
| Rust | 1.85+ | https://rustup.rs |
| WebView2 | latest | Pre-installed on Windows 11 |

### Development

```bash
npm install
npm run tauri dev
```

> ⚠️ **IMPORTANT: Run on your OS directly, not inside the Docker/Podman container.**
>
> - **Windows** → open PowerShell / Windows Terminal, run commands there
> - **macOS** → open Terminal, run commands there
> - **WSL2 on Windows 11** → WSLg must be active (`echo $DISPLAY` should return `:0`)
>
> Tauri needs a real display server to open a window. The `comnyang_dev`
> container is **headless** and only for `cargo check` / `cargo test` / `npm run build`.

### If you see "Failed to initialize GTK backend"

This means Tauri tried to open a window without a display server. Fix:

**On Windows:** Use PowerShell/cmd, not WSL2
```powershell
cd C:\path\to\saas-cat-pat-desktop
npm run tauri dev
```

**On WSL2 (Windows 11):** Make sure WSLg is running
```bash
echo $DISPLAY        # must show :0
echo $WAYLAND_DISPLAY # must show wayland-0

# If empty → fix WSLg:
# In PowerShell: wsl --update && wsl --shutdown
# Then reopen WSL2 terminal
```

---

## 🐳 Dev Container (Podman / Docker)

The container is for headless CI tasks only:

```bash
# Start container
podman-compose up -d --build   # first run (builds image ~5 min)
podman-compose up -d           # subsequent runs

# Run tasks inside container
podman exec -it comnyang_dev bash

# Inside container:
cargo check          # ✅ verify Rust compiles
cargo fmt --check    # ✅ formatting check
cargo clippy         # ✅ linter
cargo test           # ✅ unit tests
npm run typecheck    # ✅ TypeScript check
npm run test         # ✅ Vitest
npm run build        # ✅ Vite production build

# ❌ DO NOT run inside container:
npm run tauri dev    # needs display server
npm run tauri build  # needs OS-native bundle tools
```

---

## 🏗️ Project Structure

```
saas-cat-pat-desktop/
├── src/                    # React + TypeScript frontend
│   ├── engine/             # PixiJS cat engine (F01-F03)
│   ├── components/         # UI components (Hub, Pomodoro, etc.)
│   ├── state/              # Zustand stores
│   ├── hooks/              # React hooks
│   └── lib/                # Tauri IPC wrapper + utilities
├── src-tauri/              # Rust backend (Tauri v2)
│   ├── src/
│   │   ├── commands/       # Tauri IPC command handlers
│   │   ├── services/       # Business logic (mood, xp, pomodoro...)
│   │   ├── integrations/   # AI providers, window watcher, notifier
│   │   └── db/             # SQLite schema + models
│   └── icons/              # App icons (all sizes)
├── db/
│   └── schema.sql          # SQLite schema (source of truth)
├── docs/
│   ├── architecture.md     # System design
│   └── specification.md    # Feature requirements
├── Dockerfile.dev          # Dev container (headless, CI tasks only)
├── podman-compose.yml      # Container orchestration
├── qa-manual-checklist.md  # Manual QA checklist
├── release-checklist.md    # Release runbook
└── .env.example            # Environment variable template
```

---

## 🧪 Running Tests

```bash
# Frontend
npm run typecheck   # TypeScript
npm run test        # Vitest unit tests

# Rust (requires Rust 1.85+)
cd src-tauri
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test --all-features
```

---

## 🚀 Building for Release

See [`release-checklist.md`](release-checklist.md) for the full runbook.

```bash
# Windows installer (.msi + .exe)
npm run tauri build

# Output:
# src-tauri/target/release/bundle/msi/Comnyang_*.msi
# src-tauri/target/release/bundle/nsis/Comnyang_*-setup.exe
```

---

## 📋 QA & DevOps

| File | Purpose |
|------|---------|
| [`qa-manual-checklist.md`](qa-manual-checklist.md) | 100+ manual test items per feature |
| [`release-checklist.md`](release-checklist.md) | Pre-build → build → sign → publish |
| [`.env.example`](.env.example) | All environment variables with docs |
| [`podman-compose.yml`](podman-compose.yml) | Dev container setup |

---

## 📐 Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop runtime | Tauri v2 |
| Backend | Rust |
| Frontend | React 18 + TypeScript |
| Animation | PixiJS v8 |
| State | Zustand |
| Database | SQLite (via sqlx) |
| Build | Vite 5 |
| CI | GitHub Actions |
