// Wires Zustand stores to their Tauri-emitted events (architecture.md §5,
// §8). Each store already owns an `initEventListeners()` method that calls
// `listenEvent` internally (see src/state/*.ts) — this hook's only job is
// to trigger that registration exactly once per window's lifetime.
//
// Called from both the "pet" and "hub" windows (App.tsx runs it
// unconditionally) — registering achievementStore/pomodoroStore/
// reminderStore listeners is harmless in the pet window (they just sit
// unused) and means the Hub window doesn't need a second wiring path.
//
// Why "once per window lifetime" and not per-component-mount: these
// listeners back app-wide state (not a DOM resource), so unlike CatEngine's
// canvas they don't need teardown on every remount. We do still guard
// against React 18 StrictMode's dev-only double-invoke of effects, which
// would otherwise double-subscribe and double-apply every event.

import { useEffect } from "react";
import { useAchievementStore } from "@/state/achievementStore";
import { useCatStore } from "@/state/catStore";
import { useMoodStore } from "@/state/moodStore";
import { usePomodoroStore } from "@/state/pomodoroStore";
import { useReminderStore } from "@/state/reminderStore";

let listenersInitialized = false;

export function useTauriEvents(): void {
  useEffect(() => {
    if (listenersInitialized) return;
    listenersInitialized = true;

    useCatStore.getState().initEventListeners();
    useMoodStore.getState().initEventListeners();
    usePomodoroStore.getState().initEventListeners();
    useReminderStore.getState().initEventListeners();
    useAchievementStore.getState().initEventListeners();

    useCatStore.getState().load();
  }, []);
}
