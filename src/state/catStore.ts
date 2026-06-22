import { create } from "zustand";
import { backend, listenEvent } from "@/lib/tauri";
import type { CatState, Personality, XpSource } from "@/types/models";

interface CatStore {
  cat: CatState | null;
  loading: boolean;
  justLeveledUp: boolean;
  load: () => Promise<void>;
  setPersonality: (p: Personality) => Promise<void>;
  rename: (name: string) => Promise<void>;
  awardXp: (source: XpSource, amount?: number) => Promise<void>;
  clearLevelUpFlag: () => void;
  initEventListeners: () => void;
}

export const useCatStore = create<CatStore>((set, get) => ({
  cat: null,
  loading: false,
  justLeveledUp: false,

  load: async () => {
    set({ loading: true });
    try {
      const cat = await backend.catGetState();
      set({ cat, loading: false });
    } catch (e) {
      console.error("Failed to load cat state", e);
      set({ loading: false });
    }
  },

  setPersonality: async (p) => {
    const cat = await backend.catSetPersonality(p);
    set({ cat });
  },

  rename: async (name) => {
    const cat = await backend.catRename(name);
    set({ cat });
  },

  awardXp: async (source, amount) => {
    const result = await backend.xpAward(source, amount);
    set({ cat: result.cat_state, justLeveledUp: result.leveled_up || get().justLeveledUp });
  },

  clearLevelUpFlag: () => set({ justLeveledUp: false }),

  initEventListeners: () => {
    void listenEvent<CatState>("xp:updated", (cat) => set({ cat }));
    void listenEvent<CatState>("level:up", (cat) => set({ cat, justLeveledUp: true }));
  },
}));
