import { create } from "zustand";
import { backend, listenEvent } from "@/lib/tauri";
import type { PomodoroPhase, PomodoroSession } from "@/types/models";
import { useCatStore } from "@/state/catStore";

const DEFAULT_FOCUS_SECONDS = 25 * 60;
const DEFAULT_BREAK_SECONDS = 5 * 60;

interface PomodoroStore {
  session: PomodoroSession | null;
  remainingSeconds: number;
  history: PomodoroSession[];
  tickHandle: ReturnType<typeof setInterval> | null;

  start: (phase: PomodoroPhase, plannedSeconds?: number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>; // completes early as "abandoned"-equivalent from the UI's perspective
  loadHistory: () => Promise<void>;
  initEventListeners: () => void;
}

function defaultSecondsFor(phase: PomodoroPhase): number {
  return phase === "focus" ? DEFAULT_FOCUS_SECONDS : DEFAULT_BREAK_SECONDS;
}

export const usePomodoroStore = create<PomodoroStore>((set, get) => ({
  session: null,
  remainingSeconds: 0,
  history: [],
  tickHandle: null,

  start: async (phase, plannedSeconds) => {
    const planned = plannedSeconds ?? defaultSecondsFor(phase);
    const session = await backend.pomodoroStart(phase, planned);
    set({ session, remainingSeconds: planned });
    startTicking(set, get);
  },

  pause: async () => {
    const { session } = get();
    if (!session) return;
    const updated = await backend.pomodoroPause(session.id);
    set({ session: updated });
    stopTicking(set, get);
  },

  resume: async () => {
    const { session } = get();
    if (!session) return;
    const updated = await backend.pomodoroResume(session.id);
    set({ session: updated });
    startTicking(set, get);
  },

  stop: async () => {
    const { session } = get();
    if (!session) return;
    const actual = session.planned_seconds - get().remainingSeconds;
    const result = await backend.pomodoroComplete(session.id, Math.max(actual, 0));
    stopTicking(set, get);
    set({ session: null, remainingSeconds: 0 });
    if (result.xp_awarded > 0) {
      await useCatStore.getState().awardXp("pomodoro", result.xp_awarded);
    }
    await get().loadHistory();
  },

  loadHistory: async () => {
    const history = await backend.pomodoroHistory();
    set({ history });
  },

  initEventListeners: () => {
    void listenEvent<PomodoroSession>("pomodoro:completed", () => {
      void get().loadHistory();
    });
  },
}));

function startTicking(set: (partial: Partial<PomodoroStore>) => void, get: () => PomodoroStore) {
  stopTicking(set, get);
  const handle = setInterval(() => {
    const { remainingSeconds, session } = get();
    if (!session || session.status !== "running") return;
    if (remainingSeconds <= 1) {
      stopTicking(set, get);
      void get().stop();
      return;
    }
    set({ remainingSeconds: remainingSeconds - 1 });
  }, 1000);
  set({ tickHandle: handle });
}

function stopTicking(set: (partial: Partial<PomodoroStore>) => void, get: () => PomodoroStore) {
  const handle = get().tickHandle;
  if (handle) clearInterval(handle);
  set({ tickHandle: null });
}
