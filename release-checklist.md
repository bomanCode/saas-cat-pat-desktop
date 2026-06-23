# Release Checklist — Comnyang 2.0

**Version:** _______________  
**Release Date:** _______________  
**Release Manager:** _______________  
**Build Machine OS:** Windows 11 / macOS / Linux  

> Run this checklist top-to-bottom for every release candidate.  
> All ✅ items must pass before tagging a release.  
> Items marked ⚠️ are recommended but not hard blockers.

---

## 1. Pre-Build Verification

### 1.1 Code Quality

```bash
# Run from repo root
cd src-tauri
```

| # | Command | Expected | Status |
|---|---------|----------|--------|
| PRE-01 ✅ | `cargo fmt --all -- --check` | Exit 0, no output | `[ ]` |
| PRE-02 ✅ | `cargo clippy --all-targets --all-features -- -D warnings` | Exit 0, no warnings | `[ ]` |
| PRE-03 ✅ | `cargo test --all-features` | All tests pass | `[ ]` |
| PRE-04 ✅ | `cd .. && npx tsc --noEmit` | Exit 0, no type errors | `[ ]` |
| PRE-05 ✅ | `npx vitest run` | All 22+ tests pass | `[ ]` |

**If any step fails — STOP. Fix before continuing.**

### 1.2 GitHub CI

| # | Check | Expected | Status |
|---|-------|----------|--------|
| PRE-06 ✅ | Latest commit on `main` branch | All CI jobs green ✅ | `[ ]` |
| PRE-07 ✅ | No open PRs with failing checks | All PRs either merged or clearly labelled post-release | `[ ]` |
| PRE-08 ✅ | CI workflow: `Frontend (typecheck, test, build)` | ✅ green | `[ ]` |
| PRE-09 ✅ | CI workflow: `Rust (fmt, clippy, test)` | ✅ green | `[ ]` |

**CI URL:** `https://github.com/bomanCode/saas-cat-pat-desktop/actions`

### 1.3 Version Bump

```bash
# 1. Bump version in package.json
# 2. Bump version in src-tauri/tauri.conf.json  → "version"
# 3. Bump version in src-tauri/Cargo.toml       → version = "x.y.z"
```

| # | Check | Expected | Status |
|---|-------|----------|--------|
| PRE-10 ✅ | `package.json` → `"version"` | Matches release version | `[ ]` |
| PRE-11 ✅ | `src-tauri/tauri.conf.json` → `"version"` | Matches release version | `[ ]` |
| PRE-12 ✅ | `src-tauri/Cargo.toml` → `version` | Matches release version | `[ ]` |
| PRE-13 ✅ | All three versions are identical | No mismatch | `[ ]` |

### 1.4 App Icons Verification

```bash
ls -la src-tauri/icons/
```

| # | File | Required | Status |
|---|------|----------|--------|
| PRE-14 ✅ | `src-tauri/icons/32x32.png` | 32×32 RGBA PNG | `[ ]` |
| PRE-15 ✅ | `src-tauri/icons/128x128.png` | 128×128 RGBA PNG | `[ ]` |
| PRE-16 ✅ | `src-tauri/icons/128x128@2x.png` | 256×256 RGBA PNG | `[ ]` |
| PRE-17 ✅ | `src-tauri/icons/icon.ico` | Multi-size ICO (≥7 frames) | `[ ]` |
| PRE-18 ✅ | `src-tauri/icons/icon.icns` | macOS ICNS | `[ ]` |

### 1.5 Environment & Secrets

| # | Check | Expected | Status |
|---|-------|----------|--------|
| PRE-19 ✅ | `.env` is NOT committed | `git status` shows no `.env` | `[ ]` |
| PRE-20 ✅ | `.env.example` is committed | Present in repo root | `[ ]` |
| PRE-21 ✅ | No hardcoded API keys in source | `git grep -r "sk-" src/` returns nothing | `[ ]` |
| PRE-22 ✅ | `TAURI_SIGNING_PRIVATE_KEY` set (Windows release) | Env var available in build shell | `[ ]` |

---

## 2. Build Steps — Windows (Primary Target)

### 2.1 Environment Setup

```powershell
# Run in PowerShell or WSL2 terminal
# Ensure correct toolchain versions

node --version      # should be 24.x
npm --version       # should be 10.x+
cargo --version     # should be 1.85+
rustc --version     # should be 1.85+
```

| # | Command | Expected | Status |
|---|---------|----------|--------|
| B-01 ✅ | `node --version` | `v24.x.x` | `[ ]` |
| B-02 ✅ | `cargo --version` | `cargo 1.85+` | `[ ]` |
| B-03 ✅ | `rustup target list --installed` | `x86_64-pc-windows-msvc` present | `[ ]` |

### 2.2 Install Dependencies

```bash
# Clean install to catch lockfile issues
rm -rf node_modules
npm ci
```

| # | Command | Expected | Status |
|---|---------|----------|--------|
| B-04 ✅ | `npm ci` | Exit 0, no warnings about missing deps | `[ ]` |

### 2.3 Frontend Production Build

```bash
npm run build
```

| # | Check | Expected | Status |
|---|-------|----------|--------|
| B-05 ✅ | `npm run build` | Exit 0 | `[ ]` |
| B-06 ✅ | `dist/` directory created | Contains `index.html` + assets | `[ ]` |
| B-07 ✅ | Bundle size check | `dist/assets/*.js` — no file > 2 MB unexpectedly | `[ ]` |

### 2.4 Rust Release Build (cargo check first)

```bash
cd src-tauri

# Step 1: Check (faster than full build — catch errors early)
cargo check --release

# Step 2: Full build (takes 5–15 minutes on first run)
cargo build --release
```

| # | Command | Expected | Status |
|---|---------|----------|--------|
| B-08 ✅ | `cargo check --release` | Exit 0 | `[ ]` |
| B-09 ✅ | `cargo build --release` | Exit 0, binary in `target/release/` | `[ ]` |

### 2.5 Tauri Bundle (Installer)

```bash
cd ..   # back to repo root

# Windows: produces .msi and .exe installers
npm run tauri build

# Installers land in:
# src-tauri/target/release/bundle/msi/     ← .msi installer
# src-tauri/target/release/bundle/nsis/    ← .exe installer (NSIS)
```

| # | Command | Expected | Status |
|---|---------|----------|--------|
| B-10 ✅ | `npm run tauri build` | Exit 0 | `[ ]` |
| B-11 ✅ | `.msi` file exists | `src-tauri/target/release/bundle/msi/Comnyang_2.x.x_x64_en-US.msi` | `[ ]` |
| B-12 ✅ | `.exe` installer exists | `src-tauri/target/release/bundle/nsis/Comnyang_2.x.x_x64-setup.exe` | `[ ]` |
| B-13 ✅ | Installer file size reasonable | `.msi` between 5 MB and 50 MB | `[ ]` |

---

## 3. Code Signing (Windows)

> **Code signing is required to prevent Windows SmartScreen from blocking the installer.**  
> Without a valid cert, users see "Windows protected your PC" and must click "More info → Run anyway".

### 3.1 Certificate Requirements

| # | Check | Status |
|---|-------|--------|
| CS-01 ✅ | Authenticode certificate obtained from CA (e.g. DigiCert, Sectigo) | `[ ]` |
| CS-02 ✅ | Certificate exported as `.pfx` / `.p12` | `[ ]` |
| CS-03 ✅ | `TAURI_SIGNING_PRIVATE_KEY` env var set to base64-encoded cert | `[ ]` |
| CS-04 ✅ | `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` env var set | `[ ]` |

### 3.2 Signing Verification

```powershell
# After build, verify the signature
Get-AuthenticodeSignature "src-tauri\target\release\bundle\msi\Comnyang_*.msi"
# Status should be: Valid
```

| # | Check | Expected | Status |
|---|-------|----------|--------|
| CS-05 ✅ | `Get-AuthenticodeSignature` on `.msi` | `Status: Valid` | `[ ]` |
| CS-06 ✅ | `Get-AuthenticodeSignature` on `.exe` | `Status: Valid` | `[ ]` |
| CS-07 ✅ | Installer runs without SmartScreen warning | No "Windows protected your PC" dialog | `[ ]` |

> **⚠️ If you don't have a certificate yet:**  
> Ship the unsigned build with a README note. Users can bypass SmartScreen manually.  
> Apply for an EV certificate to eliminate SmartScreen entirely (recommended before public launch).

---

## 4. Smoke Test — Installed Release Build

Install the `.msi` on a clean Windows 11 machine (or VM) and run these tests.  
**Do NOT skip this — release builds behave differently from `tauri dev`.**

| # | Test | Expected | Status |
|---|------|----------|--------|
| SM-01 ✅ | Install via `.msi` | No error during install | `[ ]` |
| SM-02 ✅ | Launch from Start Menu | App launches, cat appears | `[ ]` |
| SM-03 ✅ | System tray icon present | Icon in tray within 3 seconds | `[ ]` |
| SM-04 ✅ | Double-click cat → Hub opens | Hub window with all panels | `[ ]` |
| SM-05 ✅ | Start Pomodoro → complete | Timer counts down, XP awarded | `[ ]` |
| SM-06 ✅ | Create reminder → fires | Notification appears at correct time | `[ ]` |
| SM-07 ✅ | XP persists after restart | Restart app, XP/level unchanged | `[ ]` |
| SM-08 ✅ | No console errors (DevTools) | F12 → Console tab clean | `[ ]` |
| SM-09 ✅ | Uninstall via Settings → Apps | App removed cleanly | `[ ]` |
| SM-10 ⚠️ | Windows Defender scan on installer | No malware detection | `[ ]` |

---

## 5. GitHub Release

### 5.1 Tag the Release

```bash
git tag -a v2.0.0 -m "Release v2.0.0 — MVP launch"
git push origin v2.0.0
```

### 5.2 Create GitHub Release

| # | Step | Status |
|---|------|--------|
| GH-01 ✅ | Go to `https://github.com/bomanCode/saas-cat-pat-desktop/releases/new` | `[ ]` |
| GH-02 ✅ | Select tag `v2.0.0` | `[ ]` |
| GH-03 ✅ | Write release notes (see template below) | `[ ]` |
| GH-04 ✅ | Upload: `Comnyang_2.x.x_x64_en-US.msi` | `[ ]` |
| GH-05 ✅ | Upload: `Comnyang_2.x.x_x64-setup.exe` | `[ ]` |
| GH-06 ✅ | Mark as "Latest release" | `[ ]` |
| GH-07 ✅ | Publish release | `[ ]` |

### 5.3 Release Notes Template

```markdown
## Comnyang 2.0.0 — MVP Release 🐱

Your AI-powered cat companion for deep work is here.

### What's New
- 🐱 Living cat engine with real-time animations (F01-F03)
- 😺 Mood & personality system (F04-F05)
- ⏱️ Pomodoro focus timer with XP rewards (F07)
- 🔔 Smart reminders with repeat rules (F08)
- 🛡️ Focus Guardian — distraction detection (F09)
- 🤖 AI presence detection (F10)
- 📚 AI Memory Vault with full-text search (F11)
- 📖 Daily story engine (F12)
- 🏆 Achievement system (F13)
- ✨ Rare event engine (F14)

### Installation
1. Download `Comnyang_2.0.0_x64_en-US.msi` (recommended)
   or `Comnyang_2.0.0_x64-setup.exe`
2. Run the installer
3. Launch Comnyang from the Start Menu

### System Requirements
- Windows 11 (Windows 10 22H2+ also supported)
- 200 MB RAM
- 100 MB disk space

### Known Issues
- [ ] List any known issues here

### Full Changelog
See [CHANGELOG.md](CHANGELOG.md)
```

---

## 6. Post-Release

| # | Step | Status |
|---|------|--------|
| POST-01 ✅ | Verify release page looks correct on GitHub | `[ ]` |
| POST-02 ✅ | Download the published installer and install fresh | `[ ]` |
| POST-03 ✅ | Run SM-01 through SM-09 on the downloaded installer | `[ ]` |
| POST-04 ⚠️ | Monitor GitHub Issues for 48 hours post-release | `[ ]` |
| POST-05 ⚠️ | Check PostHog (if enabled) for crash events | `[ ]` |
| POST-06 ⚠️ | Bump `package.json` version to next dev version (`2.1.0-dev`) | `[ ]` |

---

## Quick Reference: Build Commands

```bash
# Full release build sequence (run from repo root)

# 1. Quality gates
npm run typecheck
npm run test
cd src-tauri && cargo fmt --all -- --check && cargo clippy --all-targets -- -D warnings && cargo test --all-features
cd ..

# 2. Frontend
npm ci
npm run build

# 3. Tauri bundle (Windows installer)
npm run tauri build

# Outputs:
# src-tauri/target/release/bundle/msi/*.msi
# src-tauri/target/release/bundle/nsis/*.exe
```

---

*This checklist must be completed for every public release.*  
*Keep a copy of the filled checklist as release evidence.*
