import { describe, it, expect } from "vitest";
import { nextPupilOffset, angularAccuracy, DEFAULT_EYE_FOLLOW_CONFIG, type Vec2 } from "@/engine/eyeFollow";

describe("F02 eye follow", () => {
  it("clamps pupil offset to maxPupilOffset regardless of cursor distance", () => {
    const socket: Vec2 = { x: 0, y: 0 };
    const farCursor: Vec2 = { x: 5000, y: 5000 };
    let offset: Vec2 = { x: 0, y: 0 };
    for (let i = 0; i < 30; i++) {
      offset = nextPupilOffset(offset, farCursor, socket);
    }
    const dist = Math.hypot(offset.x, offset.y);
    expect(dist).toBeLessThanOrEqual(DEFAULT_EYE_FOLLOW_CONFIG.maxPupilOffset + 0.01);
  });

  it("converges toward the cursor direction over successive ticks (no jitter — monotonic approach)", () => {
    const socket: Vec2 = { x: 0, y: 0 };
    const cursor: Vec2 = { x: 100, y: 0 };
    let offset: Vec2 = { x: 0, y: 0 };
    let lastDist = 0;
    for (let i = 0; i < 10; i++) {
      offset = nextPupilOffset(offset, cursor, socket);
      const dist = Math.hypot(offset.x, offset.y);
      expect(dist).toBeGreaterThanOrEqual(lastDist - 1e-9); // monotonic, no oscillation
      lastDist = dist;
    }
  });

  it("reports near-perfect angular accuracy when pupil is pointed straight at the cursor", () => {
    const socket: Vec2 = { x: 0, y: 0 };
    const cursor: Vec2 = { x: 50, y: 0 };
    const target: Vec2 = { x: 4, y: 0 }; // same direction as cursor
    const accuracy = angularAccuracy(target, cursor, socket);
    expect(accuracy).toBeGreaterThan(0.95);
  });

  it("reports low accuracy when pupil points perpendicular to the cursor", () => {
    const socket: Vec2 = { x: 0, y: 0 };
    const cursor: Vec2 = { x: 50, y: 0 };
    const target: Vec2 = { x: 0, y: 4 };
    const accuracy = angularAccuracy(target, cursor, socket);
    expect(accuracy).toBeLessThan(0.1);
  });

  it("handles cursor exactly at the socket without NaN", () => {
    const offset = nextPupilOffset({ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 5, y: 5 });
    expect(Number.isFinite(offset.x)).toBe(true);
    expect(Number.isFinite(offset.y)).toBe(true);
  });
});
