import { describe, it, expect } from "vitest";
import { nextState, type StateMachineInput } from "@/engine/behaviors/stateMachine";

function input(overrides: Partial<StateMachineInput> = {}): StateMachineInput {
  return {
    idleMs: 0,
    cursorNear: false,
    isDragging: false,
    dragJustEnded: false,
    mood: "happy",
    random: 0.5,
    ...overrides,
  };
}

describe("F01 behavior state machine", () => {
  it("stays in current state while dragging", () => {
    expect(nextState("walking", input({ isDragging: true }))).toBe("walking");
  });

  it("returns to idle the frame a drag ends", () => {
    expect(nextState("sitting", input({ dragJustEnded: true }))).toBe("idle");
  });

  it("transitions to watching_cursor when cursor is near", () => {
    expect(nextState("idle", input({ cursorNear: true }))).toBe("watching_cursor");
  });

  it("leaves watching_cursor after the grace period once cursor is far", () => {
    const farButRecent = nextState("watching_cursor", input({ cursorNear: false, idleMs: 1000 }));
    expect(farButRecent).toBe("watching_cursor");
    const farAndStale = nextState("watching_cursor", input({ cursorNear: false, idleMs: 4000 }));
    expect(farAndStale).toBe("idle");
  });

  it("becomes sitting/walking-variant when mood is focused", () => {
    expect(nextState("idle", input({ mood: "focused" }))).toBe("sitting");
    expect(nextState("walking", input({ mood: "focused" }))).toBe("walking");
  });

  it("falls asleep when sleepy and idle long enough", () => {
    expect(nextState("idle", input({ mood: "sleepy", idleMs: 61_000 }))).toBe("sleeping");
  });

  it("wakes up from sleeping on fresh activity", () => {
    expect(nextState("sleeping", input({ idleMs: 0 }))).toBe("idle");
    expect(nextState("sleeping", input({ idleMs: 50_000 }))).toBe("sleeping");
  });

  it("picks a mood-weighted idle variant after the notice threshold", () => {
    const result = nextState("idle", input({ idleMs: 25_000, random: 0.05 }));
    expect(["sitting", "grooming", "walking"]).toContain(result);
  });

  it("never produces an undefined/invalid state across many random ticks", () => {
    const valid = new Set(["idle", "sleeping", "walking", "watching_cursor", "sitting", "grooming"]);
    let state: ReturnType<typeof nextState> = "idle";
    for (let i = 0; i < 500; i++) {
      state = nextState(state, input({ idleMs: i * 200, random: Math.random(), mood: "happy" }));
      expect(valid.has(state)).toBe(true);
    }
  });
});
