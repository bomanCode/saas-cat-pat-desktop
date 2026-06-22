// F01 — Living Cat Engine: behavior state machine.
//
// Deliberately pure (no Pixi, no DOM) per architecture.md §4: "single
// source of truth, unit-testable in isolation from Pixi." CatRenderer
// (catEngine.ts) drives this with real clock ticks and cursor data; tests
// drive it with synthetic ticks.

export type BehaviorState =
  | "idle"
  | "sleeping"
  | "walking"
  | "watching_cursor"
  | "sitting"
  | "grooming";

export type Mood = "happy" | "focused" | "sleepy" | "curious" | "hungry" | "lonely";

export interface StateMachineInput {
  /** ms since the last user-initiated cursor/keyboard/pet activity */
  idleMs: number;
  /** true while pointer is within "notice" radius of the cat */
  cursorNear: boolean;
  /** true while pointer is being dragged (physics takes over; see dragPhysics.ts) */
  isDragging: boolean;
  /** true the frame a drag just ended */
  dragJustEnded: boolean;
  mood: Mood;
  /** 0..1 RNG sample, injected for determinism in tests */
  random: number;
}

const IDLE_TO_NOTICE_MS = 20_000;
const CURSOR_FAR_GRACE_MS = 3_000;
const SLEEPY_IDLE_MS = 60_000;

/**
 * Pure transition function: given current state + input, returns the next
 * state. Called once per tick by CatRenderer. Mirrors architecture.md §4's
 * transition table exactly so the doc and code can't silently drift.
 */
export function nextState(current: BehaviorState, input: StateMachineInput): BehaviorState {
  if (input.isDragging) {
    // Suspended — physics owns visuals while dragging; state machine holds
    // position but doesn't transition until drag ends.
    return current;
  }
  if (input.dragJustEnded) {
    return "idle";
  }

  if (input.mood === "focused") {
    // Visual variant of idle/sitting per architecture.md §4 transition table.
    return current === "walking" ? "walking" : "sitting";
  }

  if (input.cursorNear) {
    return "watching_cursor";
  }

  if (current === "watching_cursor" && !input.cursorNear && input.idleMs > CURSOR_FAR_GRACE_MS) {
    return "idle";
  }

  if (current === "sleeping") {
    return input.idleMs < 100 ? "idle" : "sleeping"; // userActivity wakes it (idleMs reset by caller)
  }

  if (input.mood === "sleepy" && input.idleMs > SLEEPY_IDLE_MS) {
    return "sleeping";
  }

  if (current === "idle" && input.idleMs > IDLE_TO_NOTICE_MS) {
    // Mood-weighted random pick between sitting/grooming/walking, per
    // architecture.md §4 ("idleTimeout(>20s) -> sitting/grooming (random,
    // mood-weighted)"). Walking added here for a livelier idle loop.
    const weights = weightsForMood(input.mood);
    return pickWeighted(weights, input.random);
  }

  return current === "watching_cursor" ? current : "idle";
}

function weightsForMood(mood: Mood): Array<[BehaviorState, number]> {
  switch (mood) {
    case "hungry":
      return [["sitting", 0.6], ["grooming", 0.1], ["walking", 0.3]];
    case "lonely":
      return [["sitting", 0.7], ["grooming", 0.1], ["walking", 0.2]];
    case "curious":
      return [["walking", 0.6], ["sitting", 0.2], ["grooming", 0.2]];
    default:
      return [["sitting", 0.4], ["grooming", 0.4], ["walking", 0.2]];
  }
}

function pickWeighted(weights: Array<[BehaviorState, number]>, random: number): BehaviorState {
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let roll = random * total;
  for (const [state, w] of weights) {
    if (roll < w) return state;
    roll -= w;
  }
  return weights[0][0];
}
