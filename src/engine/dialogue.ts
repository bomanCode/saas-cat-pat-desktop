// F05 — Personality Engine (frontend dialogue layer).
//
// The authoritative personality trait lives server-side (cat_state.personality,
// see catStore.ts). This module owns only the *cosmetic* line-selection for
// instant, no-IPC-round-trip speech bubbles — mirrors the weighting scheme
// in src-tauri/src/services/personality_service.rs so behavior is
// consistent whether a line is picked here or (for analytics-relevant
// contexts like PomodoroComplete) confirmed server-side.

import type { Personality } from "@/types/models";

export type DialogueContext =
  | "idle"
  | "pomodoro_complete"
  | "reminder_fired"
  | "level_up"
  | "focus_guardian_nudge"
  | "greeting";

interface Line {
  text: string;
  weightFor: Personality[];
}

const BASE_WEIGHT = 1;
const MATCH_WEIGHT = 8;

const POOLS: Record<DialogueContext, Line[]> = {
  greeting: [
    { text: "Mrow... oh, you're here. I guess that's fine.", weightFor: ["tsundere"] },
    { text: "YOU'RE BACK YOU'RE BACK let's GO let's GOOO!", weightFor: ["hyper"] },
    { text: "Welcome back. I logged 3 things while you were away.", weightFor: ["smart"] },
    { text: "*immediately sits on your hands* missed you.", weightFor: ["clingy"] },
    { text: "...five more minutes.", weightFor: ["lazy"] },
  ],
  pomodoro_complete: [
    { text: "Good. You didn't completely waste that time.", weightFor: ["tsundere"] },
    { text: "POMODORO DESTROYED! XP incoming!!", weightFor: ["hyper"] },
    { text: "Session logged. Your focus streak is improving.", weightFor: ["smart"] },
    { text: "You did it! Can I sit with you now? Please?", weightFor: ["clingy"] },
    { text: "huh, we're done already? okay nap time then.", weightFor: ["lazy"] },
  ],
  reminder_fired: [
    { text: "Hey. Drink water. Not because I care or anything.", weightFor: ["tsundere"] },
    { text: "HYDRATION CHECK! GO GO GO!", weightFor: ["hyper"] },
    { text: "Reminder: this is the optimal time for that task.", weightFor: ["smart"] },
    { text: "Pssst. Reminder. Also please don't leave.", weightFor: ["clingy"] },
    { text: "...there's a reminder. you deal with it.", weightFor: ["lazy"] },
  ],
  level_up: [
    { text: "Tch. Fine, you leveled up. Happy now?", weightFor: ["tsundere"] },
    { text: "LEVEL UP LEVEL UP LEVEL UUUP!!!", weightFor: ["hyper"] },
    { text: "Growth milestone reached. Statistically impressive.", weightFor: ["smart"] },
    { text: "We leveled up TOGETHER. I'm so proud!", weightFor: ["clingy"] },
    { text: "mm, level up. cool. anyway, nap.", weightFor: ["lazy"] },
  ],
  focus_guardian_nudge: [
    { text: "...are you seriously watching that right now?", weightFor: ["tsundere"] },
    { text: "DISTRACTION DETECTED ABORT ABORT— I mean, focus!", weightFor: ["hyper"] },
    { text: "Noted: a context switch just occurred. Costly.", weightFor: ["smart"] },
    { text: "Hey hey hey come back I miss your focus face.", weightFor: ["clingy"] },
    { text: "eh, whatever you're doing is fine I guess.", weightFor: ["lazy"] },
  ],
  idle: [
    { text: "Don't look at me like that. I'm just resting.", weightFor: ["tsundere"] },
    { text: "bored bored bored let's DO something!!", weightFor: ["hyper"] },
    { text: "Calculating optimal nap angle.", weightFor: ["smart"] },
    { text: "*stares at you until you notice*", weightFor: ["clingy"] },
    { text: "zzz...", weightFor: ["lazy"] },
  ],
};

/** Mulberry32 — tiny deterministic PRNG so dialogue picks are seed-testable, matching the Rust StdRng test pattern. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickLine(personality: Personality, ctx: DialogueContext, seed: number = Date.now()): string {
  const lines = POOLS[ctx];
  const weights = lines.map((l) => (l.weightFor.includes(personality) ? MATCH_WEIGHT : BASE_WEIGHT));
  const total = weights.reduce((a, b) => a + b, 0);
  const rng = mulberry32(seed);
  let roll = rng() * total;
  for (let i = 0; i < lines.length; i++) {
    if (roll < weights[i]) return lines[i].text;
    roll -= weights[i];
  }
  return lines[0].text;
}
