import { create } from "zustand";
import { backend } from "@/lib/tauri";

interface SettingsStore {
  settings: Record<string, unknown>;
  load: () => Promise<void>;
  update: (key: string, value: unknown) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: {},

  load: async () => {
    const settings = await backend.settingsGet();
    set({ settings });
  },

  update: async (key, value) => {
    await backend.settingsUpdate(key, value);
    set({ settings: { ...get().settings, [key]: value } });
  },
}));
