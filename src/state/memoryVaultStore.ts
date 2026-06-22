import { create } from "zustand";
import { backend } from "@/lib/tauri";
import type { AiMemoryEntry, AiMemoryKind, AiSourceProvider } from "@/types/models";

interface MemoryVaultStore {
  entries: AiMemoryEntry[];
  query: string;
  activeTag: string | null;
  tags: string[];

  setQuery: (q: string) => void;
  setActiveTag: (t: string | null) => void;
  search: () => Promise<void>;
  save: (kind: AiMemoryKind, content: string, sourceProvider?: AiSourceProvider, tags?: string[]) => Promise<void>;
  remove: (id: number) => Promise<void>;
  loadTags: () => Promise<void>;
}

export const useMemoryVaultStore = create<MemoryVaultStore>((set, get) => ({
  entries: [],
  query: "",
  activeTag: null,
  tags: [],

  setQuery: (q) => set({ query: q }),
  setActiveTag: (t) => set({ activeTag: t }),

  search: async () => {
    const { query, activeTag } = get();
    const entries = await backend.memorySearch(query, activeTag ?? undefined);
    set({ entries });
  },

  save: async (kind, content, sourceProvider, tags) => {
    await backend.memorySave(kind, content, sourceProvider, tags);
    await get().search();
    await get().loadTags();
  },

  remove: async (id) => {
    await backend.memoryDelete(id);
    await get().search();
  },

  loadTags: async () => {
    const tags = await backend.memoryListTags();
    set({ tags });
  },
}));
