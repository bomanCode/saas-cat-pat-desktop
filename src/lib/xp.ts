// Mirrors src-tauri/src/services/xp_service.rs cumulative_xp_for_level /
// level_for_xp / growth_stage_for_level EXACTLY — see that file's module
// doc for why this is piecewise-linear (PRD's three anchor points aren't
// collinear under any single power law). Frontend needs its own copy only
// because the mock backend (lib/tauri.ts) and the Hub's XP progress bar
// both need this without a round-trip; the real backend is still the
// authoritative source for `cat_state.level`/`xp_total` themselves.

import type { GrowthStage } from "@/types/models";

export function cumulativeXpForLevel(level: number): number {
  if (level <= 0) return 0;
  if (level <= 10) return 100 * level;
  if (level <= 50) return 1000 + (level - 10) * 225;
  return 10000 + (level - 50) * 450;
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (cumulativeXpForLevel(level + 1) <= xp) level++;
  return level;
}

export function growthStageForLevel(level: number): GrowthStage {
  if (level < 10) return "kitten";
  if (level < 25) return "teen";
  if (level < 50) return "adult";
  return "legendary";
}

export interface LevelProgress {
  level: number;
  xpIntoLevel: number;
  xpNeededForLevel: number;
  pct: number; // 0..100
}

/** Progress within the *current* level band, for a progress bar. */
export function progressWithinLevel(xpTotal: number): LevelProgress {
  const level = levelForXp(xpTotal);
  const floor = cumulativeXpForLevel(level);
  const ceiling = cumulativeXpForLevel(level + 1);
  const span = Math.max(ceiling - floor, 1);
  const into = Math.max(xpTotal - floor, 0);
  return {
    level,
    xpIntoLevel: into,
    xpNeededForLevel: span,
    pct: Math.min(100, Math.round((into / span) * 100)),
  };
}
