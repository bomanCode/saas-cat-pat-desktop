# QA Manual Checklist — Comnyang 2.0

**Version:** 2.0.0  
**Platform:** Windows 11 (primary) · macOS · Linux/WSL2  
**Tester:** _______________  
**Date:** _______________  
**Build:** _______________  

> **Cara pakai:** Centang `[x]` setiap item setelah diverifikasi.  
> Evidence wajib dilampirkan untuk semua item bertanda 📸.  
> Bug ditemukan → isi template di bagian **Bug Report Template** di bawah.

---

## Legend

| Simbol | Arti |
|--------|------|
| ✅ | Harus pass sebelum rilis |
| ⚠️ | Nice-to-have, tidak memblokir rilis |
| 📸 | Wajib screenshot/recording sebagai evidence |
| 📋 | Cukup catat output log |

---

## 1. Window System

### 1.1 Pet Window (Transparent Overlay)

**Pre-condition:** App sudah di-build (`npm run tauri build`) dan diinstall, atau jalankan `npm run tauri dev`.

| # | Step | Expected Result | Evidence | Status |
|---|------|----------------|----------|--------|
| W-01 ✅📸 | Launch app | Pet window muncul di atas desktop, cat sprite terlihat | Screenshot window di desktop | `[ ]` |
| W-02 ✅📸 | Periksa background pet window | Background **transparan** — wallpaper/app di belakang terlihat tembus | Screenshot menunjukkan transparansi | `[ ]` |
| W-03 ✅ | Klik area kosong di sekitar kucing | Klik menembus ke window di belakang (click-through) | Klik tombol app di belakang, harus berfungsi | `[ ]` |
| W-04 ✅ | Klik langsung pada sprite kucing | Klik **tidak** menembus — kucing merespons interaksi | Kucing bereaksi (animasi/mood change) | `[ ]` |
| W-05 ✅📸 | Buka app lain (browser, IDE) | Pet window tetap tampil **di atas** semua window lain | Screenshot menunjukkan kucing di foreground | `[ ]` |
| W-06 ✅ | Minimize semua window (Win+D) | Pet window tetap terlihat di desktop | Kucing tidak hilang saat Show Desktop | `[ ]` |
| W-07 ✅ | Resize desktop / ubah resolusi | Pet window repositioning ke corner yang benar | Tidak ada artefak, posisi tetap valid | `[ ]` |
| W-08 ✅📸 | Multi-monitor: drag app ke monitor 2 | Pet window tetap di monitor yang benar, transparansi terjaga | Screenshot di monitor 2 | `[ ]` |

**Cara ambil evidence W-02 (transparansi):**
```
Win + Shift + S → pilih area pet window
Pastikan wallpaper terlihat di background sprite
```

---

### 1.2 Hub Window (Dashboard)

| # | Step | Expected Result | Evidence | Status |
|---|------|----------------|----------|--------|
| W-09 ✅📸 | Double-click pada kucing ATAU klik tray → "Open Hub" | Hub window terbuka dengan ukuran normal | Screenshot Hub window | `[ ]` |
| W-10 ✅ | Hub window muncul | Background Hub **tidak transparan** (solid, styled) | Visual check | `[ ]` |
| W-11 ✅ | Tutup Hub window (X button) | Hub tertutup, pet window tetap aktif | Pet masih terlihat setelah Hub ditutup | `[ ]` |
| W-12 ✅ | Buka Hub dua kali berturut-turut | Window yang sudah ada di-focus, bukan duplicate baru | Hanya satu Hub window yang ada | `[ ]` |
| W-13 ⚠️ | Drag Hub window ke posisi lain | Window bisa di-drag, posisi tersimpan untuk sesi berikutnya | Reopen Hub → posisi sama | `[ ]` |

---

## 2. Cat Engine & Animations (F01–F03)

| # | Step | Expected Result | Evidence | Status |
|---|------|----------------|----------|--------|
| A-01 ✅📸 | Biarkan app idle 30 detik | Kucing melakukan animasi idle (breathing/blinking) | Screen recording 30 detik | `[ ]` |
| A-02 ✅📸 | Gerakkan cursor mendekati kucing | **Mata kucing mengikuti cursor** (eye follow system) | Recording cursor movement | `[ ]` |
| A-03 ✅ | Gerakkan cursor sangat cepat | Mata tetap smooth, tidak jittering | Visual check | `[ ]` |
| A-04 ✅📸 | Klik dan drag kucing | Kucing bisa di-drag, ada stretch/wobble animation | Recording drag physics | `[ ]` |
| A-05 ✅ | Lepas kucing setelah drag | Kucing "jatuh" dengan fisika natural (wobble settle) | Visual check | `[ ]` |
| A-06 ✅ | Biarkan idle 5 menit | State machine berpindah ke Sleeping/Sitting | Animasi tidur/duduk muncul | `[ ]` |
| A-07 ✅ | Check FPS | FPS stabil ≥ 55 selama 60 detik | Buka DevTools → Performance tab, catat FPS | `[ ]` |
| A-08 ✅ | Check CPU usage saat idle | CPU < 5% saat tidak ada interaksi | Task Manager → catat % CPU | `[ ]` |
| A-09 ✅ | Check RAM usage | RAM < 200 MB | Task Manager → catat MB | `[ ]` |

**Cara ambil evidence FPS (A-07):**
```
F12 → Console → ketik: __PIXI_APP__.ticker.FPS
Atau buka Performance tab, record 10 detik
```

---

## 3. Mood System (F04)

| # | Step | Expected Result | Evidence | Status |
|---|------|----------------|----------|--------|
| M-01 ✅📸 | Launch fresh, lihat mood indicator di Hub | Mood default **Happy** | Screenshot mood badge | `[ ]` |
| M-02 ✅ | Biarkan app idle 15+ menit tanpa interaksi | Mood berubah ke **Lonely** atau **Sleepy** | Catat waktu perubahan | `[ ]` |
| M-03 ✅ | Start Pomodoro focus session | Mood berubah ke **Focused** dalam 30 detik | Mood badge di Hub berubah | `[ ]` |
| M-04 ✅ | Interact dengan kucing (klik/drag) | Mood kembali **Happy** atau **Curious** | Visual check | `[ ]` |
| M-05 ✅📋 | Cek Rust log saat mood berubah | Log menampilkan `mood:changed` event dengan nilai baru | `RUST_LOG=comnyang=debug` → catat log | `[ ]` |
| M-06 ✅ | Mood change tercermin di animasi kucing | Ekspresi/postur kucing berubah sesuai mood | Visual comparison screenshot | `[ ]` |

---

## 4. Personality System (F05)

| # | Step | Expected Result | Evidence | Status |
|---|------|----------------|----------|--------|
| P-01 ✅ | Buka Hub → Settings → ubah personality ke "Hyper" | Personality tersimpan | Reload app, cek personality masih "Hyper" | `[ ]` |
| P-02 ✅📸 | Interact dengan kucing setelah set personality | Dialog/speech bubble mencerminkan personality (Hyper = energetik) | Screenshot speech bubble | `[ ]` |
| P-03 ✅ | Ubah personality ke semua 5 tipe satu per satu | Setiap personality tersimpan dan persist | Settings menampilkan nilai yang benar | `[ ]` |
| P-04 ✅ | Restart app setelah ubah personality | Personality tetap sama setelah restart | Visual + Settings check | `[ ]` |

---

## 5. System Tray (F15)

| # | Step | Expected Result | Evidence | Status |
|---|------|----------------|----------|--------|
| T-01 ✅📸 | Launch app | Ikon Comnyang muncul di system tray (bottom-right Windows) | Screenshot tray area | `[ ]` |
| T-02 ✅ | Hover ikon tray | Tooltip muncul ("Comnyang") | Visual check | `[ ]` |
| T-03 ✅📸 | Klik kanan ikon tray | Context menu muncul dengan item: "Open Hub", "Start Focus", "Quit" | Screenshot menu | `[ ]` |
| T-04 ✅ | Klik "Open Hub" dari tray menu | Hub window terbuka / di-focus | Hub window muncul | `[ ]` |
| T-05 ✅ | Klik "Start Focus" dari tray menu | Pomodoro 25-menit mulai berjalan, Hub terbuka otomatis | Hub Timer menunjukkan sesi aktif | `[ ]` |
| T-06 ✅ | Klik "Start Focus" saat sesi sudah aktif | Sesi tidak ter-override, Hub tetap fokus ke timer yang berjalan | Timer tidak reset | `[ ]` |
| T-07 ✅ | Klik "Quit" dari tray menu | App menutup sepenuhnya, ikon hilang dari tray | Task Manager: proses tidak ada | `[ ]` |

---

## 6. Desktop Notifications

| # | Step | Expected Result | Evidence | Status |
|---|------|----------------|----------|--------|
| N-01 ✅📸 | Buat reminder → tunggu waktu fire | Notifikasi native Windows muncul dengan title dan body yang benar | Screenshot notifikasi | `[ ]` |
| N-02 ✅ | Notifikasi reminder muncul | Body mengandung nama/pesan reminder yang dibuat | Text di notifikasi sesuai | `[ ]` |
| N-03 ✅📸 | Pomodoro selesai (set timer singkat 1 menit) | Notifikasi "Pomodoro complete!" muncul | Screenshot notifikasi | `[ ]` |
| N-04 ✅ | Focus distraction detected (buka YouTube saat focus mode) | Friendly reminder notification muncul dari kucing | Notifikasi muncul dalam 30 detik | `[ ]` |
| N-05 ✅ | Klik notifikasi | Hub window terbuka dan fokus ke section yang relevan | Hub terbuka dengan context benar | `[ ]` |
| N-06 ⚠️ | Mode "Do Not Disturb" Windows aktif | Notifikasi tidak membypass DND (hormat pengaturan OS) | Notifikasi tidak muncul | `[ ]` |

**Cara test N-03 (timer singkat):**
```
Di Hub → Pomodoro → set durasi 1 menit
Start → tunggu selesai → cek notifikasi
```

---

## 7. Pomodoro Timer (F07)

| # | Step | Expected Result | Evidence | Status |
|---|------|----------------|----------|--------|
| POM-01 ✅📸 | Hub → Pomodoro → klik Start (25 min) | Timer berjalan countdown, phase = "focus" | Screenshot timer aktif | `[ ]` |
| POM-02 ✅ | Timer berjalan 60 detik | Countdown akurat (turun 1 detik per detik) | Bandingkan dengan stopwatch | `[ ]` |
| POM-03 ✅ | Klik Pause | Timer berhenti, state = paused | Timer tidak bergerak | `[ ]` |
| POM-04 ✅ | Klik Resume setelah Pause | Timer melanjutkan dari posisi paused | Nilai tidak reset | `[ ]` |
| POM-05 ✅📸 | Tutup Hub saat timer berjalan, buka lagi | Timer masih berjalan dari posisi yang benar | Screenshot timer setelah reopen | `[ ]` |
| POM-06 ✅📸 | Timer selesai | Notifikasi muncul + XP diberikan + kucing animasi celebration | Screenshot XP gain + notifikasi | `[ ]` |
| POM-07 ✅ | Hub → Pomodoro → History | Session yang sudah selesai terdaftar dengan durasi benar | List menampilkan session | `[ ]` |
| POM-08 ✅ | Restart app saat timer aktif | (Expected: sesi tidak persist — ini by design; catat jika berbeda) | State setelah restart | `[ ]` |
| POM-09 ✅ | Start break session (5 min) | Phase = "break", timer jalan, tidak ada XP saat selesai break | Phase label benar | `[ ]` |

---

## 8. Smart Reminder (F08)

| # | Step | Expected Result | Evidence | Status |
|---|------|----------------|----------|--------|
| R-01 ✅📸 | Hub → Reminder → tambah reminder baru | Form muncul: title, body, waktu, repeat | Screenshot form | `[ ]` |
| R-02 ✅ | Isi semua field → Save | Reminder muncul di daftar | List menampilkan item baru | `[ ]` |
| R-03 ✅ | Edit reminder yang sudah ada | Perubahan tersimpan | Data berubah sesuai edit | `[ ]` |
| R-04 ✅ | Delete reminder | Reminder hilang dari daftar | List tidak mengandung item | `[ ]` |
| R-05 ✅📸 | Set reminder 2 menit dari sekarang, tunggu | Notifikasi muncul tepat waktu | Screenshot + catat timestamp | `[ ]` |
| R-06 ✅ | Set reminder repeat "Daily" | Setelah fire, `next_fire_at` diupdate ke hari berikutnya | Cek di Hub setelah notif | `[ ]` |
| R-07 ✅ | Set reminder di DST boundary (jika relevan) | Waktu tetap akurat | Catat jika ada anomali | `[ ]` |
| R-08 ✅ | Nonaktifkan reminder (toggle) | Reminder tidak fire saat waktu tiba | Tidak ada notifikasi | `[ ]` |
| R-09 ✅ | Restart app → cek daftar reminder | Semua reminder masih ada | List identik dengan sebelum restart | `[ ]` |

---

## 9. XP & Growth System (F06)

| # | Step | Expected Result | Evidence | Status |
|---|------|----------------|----------|--------|
| X-01 ✅📸 | Lihat XP bar di Hub | XP bar menampilkan nilai + level yang benar | Screenshot XP display | `[ ]` |
| X-02 ✅📸 | Complete Pomodoro session | +20 XP diberikan, animasi XP gain di pet window | Screenshot before/after XP | `[ ]` |
| X-03 ✅ | Complete reminder | +5 XP diberikan | XP bertambah 5 | `[ ]` |
| X-04 ✅📸 | Akumulasi XP hingga level up | Level up badge muncul di pet window, level di Hub naik | Screenshot level up | `[ ]` |
| X-05 ✅ | Restart app setelah XP gain | XP dan level tetap sama | Nilai tidak reset | `[ ]` |
| X-06 ✅📋 | Check XP events di log | `xp:updated` event ter-emit setiap XP gain | `RUST_LOG=comnyang=debug` → cek log | `[ ]` |
| X-07 ✅ | Hub → lihat growth stage indicator | "Kitten" → "Teen" → "Adult" → "Legendary" sesuai level | Text/badge sesuai | `[ ]` |

**Level thresholds:**
- Level 1: 0 XP · Level 2: 100 XP · Level 10: ~1000 XP

---

## 10. AI Memory Vault (F11)

| # | Step | Expected Result | Evidence | Status |
|---|------|----------------|----------|--------|
| V-01 ✅📸 | Hub → Memory Vault | Panel terbuka dengan search bar dan list | Screenshot panel | `[ ]` |
| V-02 ✅ | Klik "Save" / tambah entry baru | Form muncul: content, kind (prompt/response/snippet), tag | Form fields benar | `[ ]` |
| V-03 ✅📸 | Isi form → Save | Entry muncul di list | Screenshot list dengan entry baru | `[ ]` |
| V-04 ✅ | Search dengan keyword dari isi entry | Entry muncul di hasil search (FTS5) | Result relevan | `[ ]` |
| V-05 ✅ | Search dengan keyword yang tidak ada | Hasil kosong, tidak error | "No results" state | `[ ]` |
| V-06 ✅ | Filter by tag | Hanya entry dengan tag tersebut yang muncul | Filter berfungsi | `[ ]` |
| V-07 ✅ | Pin entry | Entry di-pin ke atas list | Posisi berubah | `[ ]` |
| V-08 ✅ | Delete entry | Entry hilang dari list | Tidak bisa di-search setelahnya | `[ ]` |
| V-09 ✅ | Restart app → cek Memory Vault | Semua entry masih ada | Data persist | `[ ]` |
| V-10 ✅ | Unlock Achievement "AI Explorer" setelah save pertama | Achievement notification muncul | Toast/badge muncul | `[ ]` |

---

## 11. Achievement System (F13)

| # | Step | Expected Result | Evidence | Status |
|---|------|----------------|----------|--------|
| AC-01 ✅📸 | Hub → Achievements | Daftar achievement dengan badge locked/unlocked | Screenshot panel | `[ ]` |
| AC-02 ✅📸 | Unlock "First Focus" (complete first Pomodoro) | Badge unlock, toast notification muncul di pet window | Screenshot toast | `[ ]` |
| AC-03 ✅ | Unlock "AI Explorer" (save first memory) | Badge unlock | Achievement tercatat | `[ ]` |
| AC-04 ✅ | Unlock achievement memberikan XP | XP bertambah setelah unlock | Catat nilai sebelum/sesudah | `[ ]` |
| AC-05 ✅ | Restart app → cek achievements | Status locked/unlocked tetap sama | Tidak ada regression | `[ ]` |

---

## 12. Daily Story Engine (F12)

| # | Step | Expected Result | Evidence | Status |
|---|------|----------------|----------|--------|
| S-01 ✅📸 | Hub → Story | Story hari ini ditampilkan | Screenshot story panel | `[ ]` |
| S-02 ✅ | Story berisi personalisasi (nama kucing, aktivitas hari ini) | Konten relevan dengan aktivitas user | Baca isi story | `[ ]` |
| S-03 ✅ | Tutup Hub, buka lagi → Story | Story yang sama ditampilkan (idempotent per hari) | Konten identik | `[ ]` |
| S-04 ✅ | Klik "Regenerate" (jika Pro tier) | Story baru di-generate | Konten berbeda | `[ ]` |
| S-05 ⚠️ | Story dengan AI provider aktif | Story lebih personal/narrative | Compare with/without AI | `[ ]` |

---

## 13. Focus Guardian & Window Watcher (F09, F10)

| # | Step | Expected Result | Evidence | Status |
|---|------|----------------|----------|--------|
| FG-01 ✅ | Start Pomodoro focus session | Focus Guardian aktif (window watcher mulai monitor) | Log menunjukkan watcher running | `[ ]` |
| FG-02 ✅📸 | Buka YouTube saat focus session aktif | Notifikasi/reminder muncul dari kucing dalam 30 detik | Screenshot notifikasi | `[ ]` |
| FG-03 ✅ | Buka YouTube di luar focus session | Tidak ada notifikasi | Tidak ada alert | `[ ]` |
| FG-04 ✅ | Buka app yang bukan distraksi (VS Code) saat focus | Tidak ada notifikasi | Tidak ada false positive | `[ ]` |
| FG-05 ✅📸 | AI tool terbuka (ChatGPT/Claude/Gemini) | Kucing menampilkan "thinking" animation | Screenshot kucing animasi | `[ ]` |
| FG-06 ✅ | Tutup AI tool | Animasi thinking berhenti | Kucing kembali ke idle/working | `[ ]` |
| FG-07 ✅📋 | Check log untuk deteksi akurasi | `ai:presence_detected` dan `focus:distraction_detected` events ter-log | `RUST_LOG=comnyang=debug` | `[ ]` |

**Daftar URL yang harus di-detect sebagai distraksi:**
- `youtube.com`, `tiktok.com`, `instagram.com`, `facebook.com`, `twitter.com/x.com`

**Daftar AI tools yang harus di-detect:**
- `chat.openai.com`, `claude.ai`, `gemini.google.com`

---

## 14. Rare Event Engine (F14)

| # | Step | Expected Result | Evidence | Status |
|---|------|----------------|----------|--------|
| RE-01 ✅ | Set `COMNYANG_RARE_EVENT_INTERVAL_SECS=60` di `.env` | Rare event check berjalan setiap menit | Log: rare event check triggered | `[ ]` |
| RE-02 ✅📸 | Tunggu rare event trigger (max 10 menit dengan interval 60s) | Kucing berubah appearance (Golden/Ghost/Ninja) | Screenshot rare event | `[ ]` |
| RE-03 ✅ | Rare event aktif → klik tombol Screenshot | File PNG tersimpan di Pictures/Comnyang/ | File ada di folder | `[ ]` |
| RE-04 ✅ | Rare event tercatat di database | Hub atau log menampilkan recent rare events | Cek via log | `[ ]` |

---

## 15. Data Persistence

| # | Step | Expected Result | Evidence | Status |
|---|------|----------------|----------|--------|
| DP-01 ✅ | Buat data (reminder, XP, memory) → Force quit app (Task Manager) | Semua data masih ada setelah relaunch | Bandingkan data sebelum/sesudah | `[ ]` |
| DP-02 ✅ | Normal quit → relaunch | Cat state, personality, XP, level sama | Visual check | `[ ]` |
| DP-03 ✅ | Lokasi database file | File ada di expected path | `%APPDATA%\com.comnyang.app\comnyang.db` | `[ ]` |
| DP-04 ✅ | Database ukuran masuk akal | File < 50 MB setelah seminggu penggunaan normal | Cek ukuran file | `[ ]` |
| DP-05 ⚠️ | Backup database manual | Copy `.db` file, restore ke install baru | Data terestore dengan benar | `[ ]` |

---

## 16. Settings (F-Settings)

| # | Step | Expected Result | Evidence | Status |
|---|------|----------------|----------|--------|
| SET-01 ✅ | Hub → Settings → ubah AI provider | Provider tersimpan | Restart → provider sama | `[ ]` |
| SET-02 ✅ | Input API key di Settings | Key tersimpan di OS keychain (bukan plaintext di db) | Cek `%APPDATA%\com.comnyang.app\comnyang.db` → tidak ada key | `[ ]` |
| SET-03 ✅ | Settings → rename kucing | Nama tersimpan, speech bubble menggunakan nama baru | Speech bubble berubah | `[ ]` |

---

## 17. Rust Stability & Error Handling

| # | Step | Expected Result | Evidence | Status |
|---|------|----------------|----------|--------|
| RS-01 ✅📋 | Jalankan app 10 menit tanpa interaksi | **Tidak ada Rust panic** | Catat log, tidak ada `panicked at` | `[ ]` |
| RS-02 ✅📋 | Jalankan app 10 menit dengan banyak interaksi | Tidak ada panic | Log clean | `[ ]` |
| RS-03 ✅📋 | Submit invalid data ke setiap form | Proper error message, tidak crash | Error ditampilkan, app tetap jalan | `[ ]` |
| RS-04 ✅ | Panggil command dengan parameter salah (via DevTools) | Tauri IPC error dikembalikan ke frontend, tidak panic | Console menampilkan error message string | `[ ]` |
| RS-05 ✅📋 | Simak log Tauri runtime | Tidak ada `WARN` atau `ERROR` level log yang tidak terduga | Catat semua warning | `[ ]` |

**Cara lihat Rust log di Windows:**
```powershell
# Set environment variable sebelum launch
$env:RUST_LOG="comnyang=debug,sqlx=warn"
& "C:\Users\<user>\AppData\Local\com.comnyang.app\comnyang.exe"
```

**Cara buka DevTools:**
```
Ctrl + Shift + I  (di pet window atau hub window)
F12
```

---

## 18. DevTools & Console Error Check

| # | Step | Expected Result | Evidence | Status |
|---|------|----------------|----------|--------|
| DC-01 ✅📸 | Buka DevTools pet window → Console tab | **Zero console errors** saat launch | Screenshot Console tab | `[ ]` |
| DC-02 ✅📸 | Buka DevTools hub window → Console tab | Zero console errors saat launch | Screenshot Console tab | `[ ]` |
| DC-03 ✅ | Monitor Console 5 menit saat penggunaan normal | Tidak ada error baru | No red entries | `[ ]` |
| DC-04 ✅ | DevTools → Network tab | Tidak ada failed request (semua offline, kecuali AI calls) | No red entries | `[ ]` |
| DC-05 ✅ | DevTools → Memory tab → Take Heap Snapshot | Heap size < 150 MB setelah 10 menit | Catat nilai | `[ ]` |
| DC-06 ✅ | Jalankan app 30 menit → retake heap snapshot | Heap tidak tumbuh signifikan (< +10 MB) — deteksi memory leak | Compare two snapshots | `[ ]` |

---

## Bug Severity Classification

| Level | Kriteria | SLA Fix |
|-------|----------|---------|
| 🔴 **Critical** | App crash, data loss, security issue | Sebelum rilis |
| 🟠 **High** | Fitur utama tidak berfungsi | Sebelum rilis |
| 🟡 **Medium** | Fitur berfungsi tapi ada UX issue | Sprint berikutnya |
| 🟢 **Low** | Kosmetik, typo, minor visual | Backlog |

---

## Bug Report Template

Gunakan template ini untuk setiap bug yang ditemukan. Copy ke GitHub Issues.

```markdown
**Title:** [Severity] Deskripsi singkat bug

**Severity:** Critical / High / Medium / Low

**Environment:**
- OS: Windows 11 22H2 / macOS 14.x / Ubuntu 22.04
- App version: 2.0.0
- Build type: dev / release
- Tauri version: 2.x.x
- Node version: x.x.x
- Rust version: 1.x.x

**Steps to Reproduce:**
1. ...
2. ...
3. ...

**Expected Result:**
Apa yang seharusnya terjadi.

**Actual Result:**
Apa yang sebenarnya terjadi.

**Logs:**
\`\`\`
paste Rust log / Console error di sini
\`\`\`

**Screenshot / Recording:**
[Lampirkan file]

**Additional Notes:**
Informasi tambahan, workaround, atau dugaan root cause.
```

---

## Performance Baseline (Target)

| Metric | Target | Cara Ukur |
|--------|--------|-----------|
| Launch time (cold) | < 3 detik | Stopwatch dari klik icon ke kucing muncul |
| FPS saat idle | ≥ 55 FPS | DevTools → Performance |
| CPU saat idle | < 5% | Task Manager |
| RAM usage | < 200 MB | Task Manager |
| Tauri IPC response | < 100ms | DevTools → Network → WS |
| DB query (simple) | < 10ms | `RUST_LOG=sqlx=debug` |

---

*Checklist ini harus diisi ulang untuk setiap build release candidate.*  
*Semua item ✅ harus pass. Item ⚠️ didiskusikan dengan tim.*
