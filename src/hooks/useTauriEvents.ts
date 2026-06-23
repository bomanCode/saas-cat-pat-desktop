// Wires Zustand stores to their Tauri-emitted events (architecture.md §5, §8).
// Each store owns an `initEventListeners()` method that calls `listenEvent`
// internally — this hook's only job is to trigger those registrations exactly
// once per window lifetime, and to handle any events that don't belong to a
// single store (tray menu actions).
//
// Called unconditionally from App.tsx, so both the pet and hub windows share
// the same listener setup. Listeners that only matter for one window (e.g.
// tray menu → open hub) are no-ops in the other window because the target
// window is already visible there.
//
// StrictMode guard: React 18 dev-mode double-invokes effects; the module-level
// `listenersInitialized` flag makes registration idempotent.

import { useEffect } from "react";
import { useAchievementStore } from "@/state/achievementStore";
import { useCatStore } from "@/state/catStore";
import { useMoodStore } from "@/state/moodStore";
import { usePomodoroStore } from "@/state/pomodoroStore";
import { useReminderStore } from "@/state/reminderStore";
import { listenEvent } from "@/lib/tauri";

let listenersInitialized = false;

/** Opens the Hub window if it exists (no-op when already in the Hub window). */
async function openHubWindow(): Promise<void> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
  const { Window } = await import("@tauri-apps/api/window");
  const hub = await Window.getByLabel("hub");
  await hub?.show();
  await hub?.setFocus();
}

export function useTauriEvents(): void {
  useEffect(() => {
    if (listenersInitialized) return;
    listenersInitialized = true;

    // --- Per-store event subscriptions ---
    useCatStore.getState().initEventListeners();
    useMoodStore.getState().initEventListeners();
    usePomodoroStore.getState().initEventListeners();
    useReminderStore.getState().initEventListeners();
    useAchievementStore.getState().initEventListeners();

    // --- Tray menu actions (not owned by any single store) ---
    // "Open Hub" tray item → bring the Hub window to focus.
    void listenEvent("tray:open_hub", () => {
      void openHubWindow();
    });

    // "Start Focus" tray item → start a 25-min focus session immediately,
    // then open the Hub so the user can see the running timer.
    // Guards: if a session is already running we skip the start (pomodoro
    // store's `start` would throw and the tray click would silently no-op,
    // which is the correct UX — don't interrupt an active session).
    void listenEvent("tray:start_focus", () => {
      const { session, start } = usePomodoroStore.getState();
      if (!session) {
        void start("focus");
      }
      void openHubWindow();
    });

    // --- Initial data load ---
    void useCatStore.getState().load();
  }, []);
}
