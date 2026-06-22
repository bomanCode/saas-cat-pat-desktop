// Thin selector hook over catStore for UI overlays (e.g. the level-up badge
// in CatStage). Deliberately NOT used inside CatEngine's per-frame tick —
// the engine reads mood/cat state via `store.getState()` directly so Pixi's
// own ticker keeps driving animation, not React re-renders
// (architecture.md §4, §10).

import { useCatStore } from "@/state/catStore";

export function useCat() {
  const cat = useCatStore((s) => s.cat);
  const loading = useCatStore((s) => s.loading);
  const justLeveledUp = useCatStore((s) => s.justLeveledUp);
  const clearLevelUpFlag = useCatStore((s) => s.clearLevelUpFlag);
  const awardXp = useCatStore((s) => s.awardXp);

  return { cat, loading, justLeveledUp, clearLevelUpFlag, awardXp };
}
