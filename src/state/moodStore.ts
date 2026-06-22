import { create } from "zustand";
import { listenEvent } from "@/lib/tauri";
import type { Mood } from "@/types/models";

interface MoodStore {
  mood: Mood;
  setMood: (m: Mood) => void;
  initEventListeners: () => void;
}

export const useMoodStore = create<MoodStore>((set) => ({
  mood: "happy",
  setMood: (m) => set({ mood: m }),
  initEventListeners: () => {
    void listenEvent<Mood>("mood:changed", (mood) => set({ mood }));
  },
}));
