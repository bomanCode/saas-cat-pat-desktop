import { describe, it, expect } from "vitest";
import { stepPhysics, simulateUntilSettled, REST_PHYSICS_STATE, DEFAULT_PHYSICS_CONFIG } from "@/engine/physics/dragPhysics";

describe("F03 drag physics", () => {
  it("clamps stretch to maxStretch even with an extreme drag target", () => {
    let state = REST_PHYSICS_STATE;
    for (let i = 0; i < 120; i++) {
      state = stepPhysics(state, { x: 10_000, y: 0 }, true, 1 / 60);
    }
    expect(Math.hypot(state.position.x, state.position.y)).toBeLessThanOrEqual(
      DEFAULT_PHYSICS_CONFIG.maxStretch + 1,
    );
  });

  it("wobble decays to rest within 1.5s after release (spec FR-03 AC)", () => {
    // Build up some stretch, then release.
    let state = REST_PHYSICS_STATE;
    for (let i = 0; i < 30; i++) {
      state = stepPhysics(state, { x: 50, y: 0 }, true, 1 / 60);
    }
    const settleTime = simulateUntilSettled(state);
    expect(settleTime).toBeLessThanOrEqual(1.5);
  });

  it("never produces NaN/Infinity even with a pathological dt", () => {
    const state = stepPhysics(REST_PHYSICS_STATE, { x: 9999, y: 9999 }, true, Number.POSITIVE_INFINITY);
    expect(Number.isFinite(state.position.x)).toBe(true);
    expect(Number.isFinite(state.position.y)).toBe(true);
    expect(Number.isFinite(state.velocity.x)).toBe(true);
    expect(Number.isFinite(state.velocity.y)).toBe(true);
  });

  it("never produces NaN with a negative or NaN dt", () => {
    const a = stepPhysics(REST_PHYSICS_STATE, { x: 10, y: 10 }, true, -5);
    const b = stepPhysics(REST_PHYSICS_STATE, { x: 10, y: 10 }, true, NaN);
    for (const s of [a, b]) {
      expect(Number.isFinite(s.position.x)).toBe(true);
      expect(Number.isFinite(s.position.y)).toBe(true);
    }
  });

  it("settles exactly to zero (not just close to it) once at rest", () => {
    let state = REST_PHYSICS_STATE;
    for (let i = 0; i < 10; i++) state = stepPhysics(state, { x: 30, y: 0 }, true, 1 / 60);
    for (let i = 0; i < 300; i++) state = stepPhysics(state, { x: 0, y: 0 }, false, 1 / 60);
    expect(state.position).toEqual({ x: 0, y: 0 });
    expect(state.velocity).toEqual({ x: 0, y: 0 });
  });
});
