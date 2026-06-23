// Companion Hub — the normal (non-transparent) window opened from the
// tray or by double-clicking the pet. Owns navigation between the F06-F14
// feature panels; each panel owns its own data loading (architecture.md
// §5 — stores are the source of truth, panels subscribe independently).

import { useState } from "react";
import { useCat } from "@/hooks/useCat";
import { useMoodStore } from "@/state/moodStore";
import { theme, moodEmoji, personalityColor } from "@/styles/theme";
import { progressWithinLevel } from "@/lib/xp";
import { PomodoroPanel } from "@/components/pomodoro/PomodoroPanel";
import { ReminderPanel } from "@/components/reminder/ReminderPanel";
import { MemoryVaultPanel } from "@/components/memory-vault/MemoryVaultPanel";
import { AchievementPanel, AchievementToast } from "@/components/achievements/AchievementPanel";
import { StoryPanel } from "@/components/story/StoryPanel";
import { SettingsPanel } from "@/components/settings/SettingsPanel";

type Tab = "overview" | "pomodoro" | "reminders" | "memory" | "achievements" | "story" | "settings";

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: "overview", label: "Overview", icon: "🐾" },
  { id: "pomodoro", label: "Pomodoro", icon: "🎯" },
  { id: "reminders", label: "Reminders", icon: "⏰" },
  { id: "memory", label: "Memory Vault", icon: "🗂️" },
  { id: "achievements", label: "Achievements", icon: "🏆" },
  { id: "story", label: "Daily Story", icon: "📖" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

export function HubApp() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        userSelect: "auto",
        background: theme.color.bg,
        color: theme.color.text,
        display: "flex",
        fontSize: 14,
      }}
    >
      <Sidebar tab={tab} setTab={setTab} />
      <main style={{ flex: 1, overflowY: "auto", padding: theme.space(7) }}>
        <HubHeader />
        <div style={{ marginTop: theme.space(6) }}>
          {tab === "overview" && <Overview onNavigate={setTab} />}
          {tab === "pomodoro" && <PomodoroPanel />}
          {tab === "reminders" && <ReminderPanel />}
          {tab === "memory" && <MemoryVaultPanel />}
          {tab === "achievements" && <AchievementPanel />}
          {tab === "story" && <StoryPanel />}
          {tab === "settings" && <SettingsPanel />}
        </div>
      </main>
      <AchievementToast />
    </div>
  );
}

function Sidebar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <nav
      style={{
        width: 200,
        flexShrink: 0,
        background: theme.color.surface,
        borderRight: `1px solid ${theme.color.border}`,
        padding: theme.space(4),
        display: "flex",
        flexDirection: "column",
        gap: theme.space(1),
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 800, padding: `${theme.space(2)} ${theme.space(3)}`, marginBottom: theme.space(3) }}>
        🐱 Comnyang
      </div>
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: theme.space(2),
            padding: `${theme.space(2)} ${theme.space(3)}`,
            borderRadius: theme.radius.md,
            border: "none",
            background: tab === t.id ? theme.color.surfaceRaised : "transparent",
            color: tab === t.id ? theme.color.text : theme.color.textMuted,
            fontSize: 13,
            fontWeight: tab === t.id ? 700 : 500,
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <span>{t.icon}</span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}

function HubHeader() {
  const { cat } = useCat();
  const mood = useMoodStore((s) => s.mood);
  if (!cat) return null;

  const progress = progressWithinLevel(cat.xp_total);

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: theme.color.surface,
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.lg,
        padding: theme.space(4),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: theme.space(4) }}>
        <div style={{ fontSize: 32 }}>🐱</div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: theme.space(2) }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>{cat.name}</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "capitalize",
                padding: `2px ${theme.space(2)}`,
                borderRadius: 999,
                background: personalityColor[cat.personality],
                color: theme.color.accentText,
              }}
            >
              {cat.personality}
            </span>
            <span style={{ fontSize: 13, color: theme.color.textMuted }}>
              {moodEmoji[mood]} {mood}
            </span>
          </div>
          <div style={{ fontSize: 12, color: theme.color.textMuted, textTransform: "capitalize" }}>
            Level {cat.level} · {cat.growth_stage}
          </div>
        </div>
      </div>

      <div style={{ width: 200 }}>
        <div style={{ fontSize: 11, color: theme.color.textMuted, marginBottom: 4, textAlign: "right" }}>
          {progress.xpIntoLevel} / {progress.xpNeededForLevel} XP
        </div>
        <div style={{ height: 6, borderRadius: 999, background: theme.color.surfaceRaised, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress.pct}%`, background: theme.color.accent }} />
        </div>
      </div>
    </header>
  );
}

function Overview({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const cards: Array<{ tab: Tab; title: string; desc: string; icon: string }> = [
    { tab: "pomodoro", title: "Start a focus session", desc: "25 minutes of deep work, Comnyang keeps watch.", icon: "🎯" },
    { tab: "reminders", title: "Set a reminder", desc: "Comnyang will nudge you, in character.", icon: "⏰" },
    { tab: "memory", title: "Browse your AI Memory Vault", desc: "Search saved prompts, responses, and snippets.", icon: "🗂️" },
    { tab: "achievements", title: "Check your achievements", desc: "See what's unlocked and what's next.", icon: "🏆" },
    { tab: "story", title: "Read today's story", desc: "A new Comnyang story, generated from your day.", icon: "📖" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: theme.space(3) }}>
      {cards.map((c) => (
        <button
          key={c.tab}
          onClick={() => onNavigate(c.tab)}
          style={{
            textAlign: "left",
            background: theme.color.surface,
            border: `1px solid ${theme.color.border}`,
            borderRadius: theme.radius.lg,
            padding: theme.space(5),
            cursor: "pointer",
            color: theme.color.text,
          }}
        >
          <div style={{ fontSize: 26, marginBottom: theme.space(2) }}>{c.icon}</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{c.title}</div>
          <div style={{ fontSize: 12, color: theme.color.textMuted }}>{c.desc}</div>
        </button>
      ))}
    </div>
  );
}
