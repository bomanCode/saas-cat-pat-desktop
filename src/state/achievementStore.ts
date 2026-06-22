import { create } from "zustand";
import { backend, listenEvent } from "@/lib/tauri";
import type { Achievement, AchievementWithProgress } from "@/types/models";

interface AchievementStore {
  achievements: AchievementWithProgress[];
  recentlyUnlocked: Achievement | null;
  load: () => Promise<void>;
  dismissToast: () => void;
  initEventListeners: () => void;
}

export const useAchievementStore = create<AchievementStore>((set, get) => ({
  achievements: [],
  recentlyUnlocked: null,

  load: async () => {
    const achievements = await backend.achievementList();
    set({ achievements });
  },

  dismissToast: () => set({ recentlyUnlocked: null }),

  initEventListeners: () => {
    void listenEvent<Achievement>("achievement:unlocked", (a) => {
      set({ recentlyUnlocked: a });
      void get().load();
    });
  },
}));
