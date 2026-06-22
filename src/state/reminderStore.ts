import { create } from "zustand";
import { backend, listenEvent } from "@/lib/tauri";
import type { Reminder, RepeatRulePayload } from "@/types/models";

interface ReminderStore {
  reminders: Reminder[];
  lastFired: Reminder | null;
  load: () => Promise<void>;
  create: (title: string, bodyTemplate: string, rule: RepeatRulePayload, firstFireAt: number) => Promise<void>;
  update: (id: number, patch: { title?: string; bodyTemplate?: string; isActive?: boolean }) => Promise<void>;
  remove: (id: number) => Promise<void>;
  initEventListeners: () => void;
}

export const useReminderStore = create<ReminderStore>((set, get) => ({
  reminders: [],
  lastFired: null,

  load: async () => {
    const reminders = await backend.reminderList();
    set({ reminders });
  },

  create: async (title, bodyTemplate, rule, firstFireAt) => {
    await backend.reminderCreate(title, bodyTemplate, rule, firstFireAt);
    await get().load();
  },

  update: async (id, patch) => {
    await backend.reminderUpdate(id, patch);
    await get().load();
  },

  remove: async (id) => {
    await backend.reminderDelete(id);
    await get().load();
  },

  initEventListeners: () => {
    void listenEvent<Reminder>("reminder:due", (r) => {
      set({ lastFired: r });
      void get().load();
    });
  },
}));
