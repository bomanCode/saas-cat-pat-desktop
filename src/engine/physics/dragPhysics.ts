// F03 — Drag & Physics.
//
// A critically-damped-ish spring model: while dragging, the body's render
// position chases the pointer (with a capped stretch vector back toward
// the anchor/rest position); on release, the spring oscillates back to
// rest and decays — giving the "wobble" effect (spec FR-03 AC: "wobble
// decays to rest within 1.5s", "no physics explosion (NaN/Infinity guard)").

export interface Vec2 {
  x: number;
  y: number;
}

export interface PhysicsConfig {
  /** Max stretch distance from rest position, in px — anatomical plausibility cap. */
  maxStretch: number;
  /** Spring stiffness (higher = snappier return). */
  stiffness: number;
  /** Damping factor (higher = less oscillation). */
  damping: number;
}

export const DEFAULT_PHYSICS_CONFIG: PhysicsConfig = {
  maxStretch: 60,
  stiffness: 120,
  damping: 14,
};

export interface PhysicsState {
  /** Current rendered offset from rest position. */
  position: Vec2;
  /** Current velocity, px/s. */
  velocity: Vec2;
}

export const REST_PHYSICS_STATE: PhysicsState = { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } };

/**
 * One simulation step. While `dragging`, `targetOffset` is the pointer's
 * offset from rest (clamped to maxStretch — the "stretch" effect); the
 * spring still simulates toward it rather than snapping instantly, which
 * is what produces the elastic feel during drag itself, not just on release.
 *
 * `dt` in seconds. Includes a NaN/Infinity guard per AC: if dt is
 * pathological (e.g. tab was backgrounded for minutes, dt could be huge)
 * the step is clamped so the spring can never blow up.
 */
export function stepPhysics(
  state: PhysicsState,
  targetOffset: Vec2,
  dragging: boolean,
  dt: number,
  config: PhysicsConfig = DEFAULT_PHYSICS_CONFIG,
): PhysicsState {
  const safeDt = Number.isFinite(dt) ? Math.min(Math.max(dt, 0), 1 / 15) : 1 / 60;

  const clampedTarget = clampToRadius(targetOffset, config.maxStretch);
  const target = dragging ? clampedTarget : { x: 0, y: 0 };

  // F = -k(x - target) - c*v  (critically damped spring toward target)
  const ax = -config.stiffness * (state.position.x - target.x) - config.damping * state.velocity.x;
  const ay = -config.stiffness * (state.position.y - target.y) - config.damping * state.velocity.y;

  let nextVx = state.velocity.x + ax * safeDt;
  let nextVy = state.velocity.y + ay * safeDt;
  let nextX = state.position.x + nextVx * safeDt;
  let nextY = state.position.y + nextVy * safeDt;

  // Guard: collapse to rest if anything went non-finite rather than
  // propagating NaN into the renderer (spec AC).
  if (![nextX, nextY, nextVx, nextVy].every(Number.isFinite)) {
    return { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } };
  }

  // Snap tiny residual motion to exact rest so the wobble doesn't run forever.
  if (!dragging && Math.hypot(nextX, nextY) < 0.05 && Math.hypot(nextVx, nextVy) < 0.05) {
    nextX = 0;
    nextY = 0;
    nextVx = 0;
    nextVy = 0;
  }

  return { position: { x: nextX, y: nextY }, velocity: { x: nextVx, y: nextVy } };
}

function clampToRadius(v: Vec2, radius: number): Vec2 {
  const len = Math.hypot(v.x, v.y);
  if (len <= radius || len === 0) return v;
  const scale = radius / len;
  return { x: v.x * scale, y: v.y * scale };
}

/** Simulates forward `seconds` worth of steps at `stepSeconds` resolution — used by tests/perf checks for settle-time assertions. */
export function simulateUntilSettled(
  initial: PhysicsState,
  config: PhysicsConfig = DEFAULT_PHYSICS_CONFIG,
  stepSeconds = 1 / 60,
  maxSeconds = 5,
): number {
  let state = initial;
  let t = 0;
  while (t < maxSeconds) {
    state = stepPhysics(state, { x: 0, y: 0 }, false, stepSeconds, config);
    t += stepSeconds;
    if (state.position.x === 0 && state.position.y === 0 && state.velocity.x === 0 && state.velocity.y === 0) {
      return t;
    }
  }
  return t;
}
