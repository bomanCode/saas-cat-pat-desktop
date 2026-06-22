// Window router — Comnyang ships one Vite build shared by two Tauri windows
// (architecture.md §3), distinguished by a `?window=` query param baked into
// each window's `url` in tauri.conf.json (`index.html?window=pet`).
//
// Only the "pet" window is defined in tauri.conf.json today; "hub" is wired
// here as a placeholder so Phase 3 (Companion Hub UI) has a clear seam to
// fill in rather than needing to touch the router again.

import type { ComponentType } from "react";
import { CatStage } from "@/components/cat";

export type WindowName = "pet" | "hub";

export function getWindowName(): WindowName {
  const params = new URLSearchParams(window.location.search);
  const w = params.get("window");
  return w === "hub" ? "hub" : "pet"; // default to pet — safest if the param is ever missing
}

function HubWindowPlaceholder() {
  // TODO(Phase 3): PomodoroWidget, ReminderPanel, MemoryVaultUI, AchievementToast,
  // StoryCard per architecture.md §2. Not in scope for CatStage integration.
  return (
    <div style={{ padding: 24, fontFamily: "inherit" }}>
      <h1>Comnyang Hub</h1>
      <p>Coming soon — Pomodoro, Reminders, Memory Vault, Achievements.</p>
    </div>
  );
}

export const routes: Record<WindowName, ComponentType> = {
  pet: CatStage,
  hub: HubWindowPlaceholder,
};
