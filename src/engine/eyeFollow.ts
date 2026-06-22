// F02 — Eye Follow System.
//
// Pure vector math, no Pixi dependency, so jitter/accuracy can be unit
// tested deterministically (spec FR-02 AC: "no visible jitter", "angular
// accuracy >95%"). CatRenderer feeds this real cursor/eye-socket positions
// each tick and applies the returned pupil offset to the Pixi display object.

export interface Vec2 {
  x: number;
  y: number;
}

export interface EyeFollowConfig {
  /** Max distance the pupil may move from eye-socket center, in px. */
  maxPupilOffset: number;
  /** 0..1 — higher = snappier, lower = smoother/laggier. */
  smoothing: number;
}

export const DEFAULT_EYE_FOLLOW_CONFIG: EyeFollowConfig = {
  maxPupilOffset: 4,
  smoothing: 0.25,
};

/**
 * Computes the next pupil offset (relative to eye-socket center) given the
 * cursor position in world space, the eye-socket's world position, and the
 * previous pupil offset (for smoothing/lerp). Clamped to a circle of
 * `maxPupilOffset` radius so pupils never visually leave the eye.
 */
export function nextPupilOffset(
  previousOffset: Vec2,
  cursorWorldPos: Vec2,
  eyeSocketWorldPos: Vec2,
  config: EyeFollowConfig = DEFAULT_EYE_FOLLOW_CONFIG,
): Vec2 {
  const dx = cursorWorldPos.x - eyeSocketWorldPos.x;
  const dy = cursorWorldPos.y - eyeSocketWorldPos.y;
  const dist = Math.hypot(dx, dy);

  // Direction toward cursor, clamped to maxPupilOffset.
  const clampedDist = Math.min(dist, config.maxPupilOffset);
  const targetX = dist === 0 ? 0 : (dx / dist) * clampedDist;
  const targetY = dist === 0 ? 0 : (dy / dist) * clampedDist;

  // Exponential smoothing (lerp toward target) — frame-rate independent
  // enough for a 60fps ticker without a dt term, since `smoothing` is
  // tuned at that cadence; CatRenderer can scale it by dt if needed later.
  const nextX = previousOffset.x + (targetX - previousOffset.x) * config.smoothing;
  const nextY = previousOffset.y + (targetY - previousOffset.y) * config.smoothing;

  return { x: nextX, y: nextY };
}

/** Angular accuracy of the *target* (pre-smoothing) direction vs. true cursor vector, in [0,1]. */
export function angularAccuracy(targetOffset: Vec2, cursorWorldPos: Vec2, eyeSocketWorldPos: Vec2): number {
  const trueDx = cursorWorldPos.x - eyeSocketWorldPos.x;
  const trueDy = cursorWorldPos.y - eyeSocketWorldPos.y;
  const trueLen = Math.hypot(trueDx, trueDy);
  const offsetLen = Math.hypot(targetOffset.x, targetOffset.y);
  if (trueLen === 0 || offsetLen === 0) return 1;
  const cos = (trueDx * targetOffset.x + trueDy * targetOffset.y) / (trueLen * offsetLen);
  return Math.max(0, cos); // 1 = perfectly aligned, 0 = perpendicular or worse
}
