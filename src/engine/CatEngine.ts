// F01 — Living Cat Engine (render layer).
//
// This is the ONLY module that touches PixiJS directly for the cat itself.
// It owns:
//   - the Application/ticker (driven independently of React re-renders,
//     per architecture.md §4 — critical for the 60fps/<5%CPU budget)
//   - placeholder vector-drawn cat art (Graphics-based; see `Renderer`
//     interface note below for the Spine swap path)
//   - wiring BehaviorStateMachine + EyeFollowController + DragPhysics +
//     Mood/Personality into per-frame visual updates
//
// Art note: MVP ships a procedural Graphics cat instead of the Spine
// skeletal animation mentioned in PRD §12, because Spine requires licensed
// runtime + exported skeleton assets that don't exist yet. The
// `CatVisual` interface below is the seam: swapping in a Spine-backed
// implementation later means implementing this interface, not touching
// the state machine, physics, or stores.

import { Application, Container, Graphics, Ticker } from "pixi.js";
import { nextState, type BehaviorState, type Mood as EngineMood } from "@/engine/behaviors/stateMachine";
import { nextPupilOffset, DEFAULT_EYE_FOLLOW_CONFIG, type Vec2 } from "@/engine/eyeFollow";
import { stepPhysics, REST_PHYSICS_STATE, type PhysicsState } from "@/engine/physics/dragPhysics";

export interface CatVisual {
  root: Container;
  setState(state: BehaviorState, t: number): void;
  setEyeOffsets(left: Vec2, right: Vec2): void;
  setPhysicsOffset(offset: Vec2): void;
  destroy(): void;
}

/** Procedural placeholder art — two circle eyes w/ pupils, an ellipse body, triangle ears. */
function buildProceduralCat(): CatVisual {
  const root = new Container();

  const body = new Graphics().ellipse(0, 10, 38, 30).fill(0xf5c16c).stroke({ width: 2, color: 0xc98a3a });
  const earLeft = new Graphics().poly([-26, -10, -34, -34, -14, -18]).fill(0xf5c16c).stroke({ width: 2, color: 0xc98a3a });
  const earRight = new Graphics().poly([26, -10, 34, -34, 14, -18]).fill(0xf5c16c).stroke({ width: 2, color: 0xc98a3a });

  const eyeSocketLeft = new Container();
  eyeSocketLeft.position.set(-13, 2);
  const eyeWhiteLeft = new Graphics().circle(0, 0, 7).fill(0xffffff);
  const pupilLeft = new Graphics().circle(0, 0, 3.2).fill(0x222222);
  eyeSocketLeft.addChild(eyeWhiteLeft, pupilLeft);

  const eyeSocketRight = new Container();
  eyeSocketRight.position.set(13, 2);
  const eyeWhiteRight = new Graphics().circle(0, 0, 7).fill(0xffffff);
  const pupilRight = new Graphics().circle(0, 0, 3.2).fill(0x222222);
  eyeSocketRight.addChild(eyeWhiteRight, pupilRight);

  const nose = new Graphics().poly([-3, 14, 3, 14, 0, 18]).fill(0xd97a8a);

  const tail = new Graphics().moveTo(30, 20).quadraticCurveTo(55, 10, 48, -10).stroke({ width: 8, color: 0xf5c16c, cap: "round" });

  const physicsLayer = new Container();
  physicsLayer.addChild(tail, body, earLeft, earRight, nose, eyeSocketLeft, eyeSocketRight);
  root.addChild(physicsLayer);

  let elapsed = 0;

  return {
    root,
    setState(state, t) {
      elapsed = t;
      const bob = Math.sin(elapsed * 4) * (state === "idle" || state === "sitting" ? 1.5 : 0);
      physicsLayer.y = bob;

      switch (state) {
        case "sleeping":
          physicsLayer.scale.set(1, 0.85);
          eyeWhiteLeft.visible = false;
          eyeWhiteRight.visible = false;
          pupilLeft.visible = false;
          pupilRight.visible = false;
          break;
        case "grooming":
          physicsLayer.rotation = Math.sin(elapsed * 6) * 0.05;
          eyeWhiteLeft.visible = true;
          eyeWhiteRight.visible = true;
          pupilLeft.visible = true;
          pupilRight.visible = true;
          break;
        case "walking":
          physicsLayer.x = Math.sin(elapsed * 3) * 6;
          eyeWhiteLeft.visible = true;
          eyeWhiteRight.visible = true;
          pupilLeft.visible = true;
          pupilRight.visible = true;
          break;
        default:
          physicsLayer.scale.set(1, 1);
          physicsLayer.rotation = 0;
          eyeWhiteLeft.visible = true;
          eyeWhiteRight.visible = true;
          pupilLeft.visible = true;
          pupilRight.visible = true;
      }
    },
    setEyeOffsets(left, right) {
      pupilLeft.position.set(left.x, left.y);
      pupilRight.position.set(right.x, right.y);
    },
    setPhysicsOffset(offset) {
      // Stretch/wobble: skew + translate the whole physics layer.
      physicsLayer.position.x += 0; // base walk-offset already applied in setState; physics adds on top via root
      root.position.set(offset.x, offset.y);
      const stretch = Math.min(Math.hypot(offset.x, offset.y) / 60, 1);
      physicsLayer.scale.set(1 + stretch * 0.15, 1 - stretch * 0.1);
    },
    destroy() {
      root.destroy({ children: true });
    },
  };
}

export interface CatEngineOptions {
  /** World-space target the eyes track; defaults to global mouse position. */
  getCursorWorldPos: () => Vec2;
  getMood: () => EngineMood;
  onInteraction?: () => void;
}

/**
 * Frame budget guard (architecture.md §10): when the window is unfocused
 * and the cat is idle, the ticker throttles to ~10fps instead of 60fps to
 * hold the <5% CPU budget, restoring full rate on focus/interaction.
 */
const IDLE_UNFOCUSED_FPS = 10;
const ACTIVE_FPS = 60;

export class CatEngine {
  private app: Application | null = null;
  private visual: CatVisual | null = null;
  private behaviorState: BehaviorState = "idle";
  private physicsState: PhysicsState = REST_PHYSICS_STATE;
  private eyeOffsetLeft: Vec2 = { x: 0, y: 0 };
  private eyeOffsetRight: Vec2 = { x: 0, y: 0 };
  private lastInteractionAt = performance.now();
  private dragging = false;
  private dragJustEnded = false;
  private dragPointerOffset: Vec2 = { x: 0, y: 0 };
  private elapsed = 0;
  private windowFocused = true;
  private destroyed = false;

  constructor(private readonly container: HTMLElement, private readonly options: CatEngineOptions) {}

  async init(): Promise<void> {
    const app = new Application();
    await app.init({
      width: 220,
      height: 220,
      backgroundAlpha: 0,
      antialias: false,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    this.app = app;
    this.container.appendChild(app.canvas);

    const visual = buildProceduralCat();
    visual.root.position.set(110, 110);
    app.stage.addChild(visual.root);
    this.visual = visual;

    visual.root.eventMode = "static";
    visual.root.cursor = "grab";
    visual.root.on("pointerdown", this.handlePointerDown);

    window.addEventListener("focus", this.handleWindowFocus);
    window.addEventListener("blur", this.handleWindowBlur);

    app.ticker.add(this.tick);
  }

  private handleWindowFocus = () => {
    this.windowFocused = true;
  };
  private handleWindowBlur = () => {
    this.windowFocused = false;
  };

  private handlePointerDown = (e: { global: { x: number; y: number } }) => {
    this.dragging = true;
    this.registerInteraction();
    const root = this.visual?.root;
    if (root) {
      this.dragPointerOffset = { x: e.global.x - root.position.x, y: e.global.y - root.position.y };
    }
    window.addEventListener("pointermove", this.handlePointerMove);
    window.addEventListener("pointerup", this.handlePointerUp);
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (!this.dragging || !this.app) return;
    const rect = this.container.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const target = { x: localX - this.dragPointerOffset.x, y: localY - this.dragPointerOffset.y };
    this.currentDragTarget = target;
  };

  private currentDragTarget: Vec2 = { x: 0, y: 0 };

  private handlePointerUp = () => {
    this.dragging = false;
    this.dragJustEnded = true;
    window.removeEventListener("pointermove", this.handlePointerMove);
    window.removeEventListener("pointerup", this.handlePointerUp);
  };

  registerInteraction(): void {
    this.lastInteractionAt = performance.now();
    this.options.onInteraction?.();
  }

  private tick = (ticker: Ticker) => {
    if (!this.visual || this.destroyed) return;
    const dtSeconds = ticker.deltaMS / 1000;
    this.elapsed += dtSeconds;

    // Perf throttle: skip every other frame (or more) when unfocused+idle.
    const idleMs = performance.now() - this.lastInteractionAt;
    const shouldThrottle = !this.windowFocused && this.behaviorState === "idle" && idleMs > 5000;
    if (shouldThrottle && this.app) {
      this.app.ticker.maxFPS = IDLE_UNFOCUSED_FPS;
    } else if (this.app) {
      this.app.ticker.maxFPS = ACTIVE_FPS;
    }

    const cursor = this.options.getCursorWorldPos();
    const root = this.visual.root;
    const eyeSocketWorld = { x: root.position.x, y: root.position.y };
    const cursorNear = Math.hypot(cursor.x - eyeSocketWorld.x, cursor.y - eyeSocketWorld.y) < 160;

    this.behaviorState = nextState(this.behaviorState, {
      idleMs,
      cursorNear,
      isDragging: this.dragging,
      dragJustEnded: this.dragJustEnded,
      mood: this.options.getMood(),
      random: Math.random(),
    });
    this.dragJustEnded = false;

    this.eyeOffsetLeft = nextPupilOffset(this.eyeOffsetLeft, cursor, { x: eyeSocketWorld.x - 13, y: eyeSocketWorld.y + 2 }, DEFAULT_EYE_FOLLOW_CONFIG);
    this.eyeOffsetRight = nextPupilOffset(this.eyeOffsetRight, cursor, { x: eyeSocketWorld.x + 13, y: eyeSocketWorld.y + 2 }, DEFAULT_EYE_FOLLOW_CONFIG);

    const dragTargetOffset = this.dragging
      ? { x: this.currentDragTarget.x - eyeSocketWorld.x, y: this.currentDragTarget.y - eyeSocketWorld.y }
      : { x: 0, y: 0 };
    this.physicsState = stepPhysics(this.physicsState, dragTargetOffset, this.dragging, dtSeconds);

    this.visual.setState(this.behaviorState, this.elapsed);
    this.visual.setEyeOffsets(this.eyeOffsetLeft, this.eyeOffsetRight);
    this.visual.setPhysicsOffset(this.physicsState.position);
  };

  getState(): BehaviorState {
    return this.behaviorState;
  }

  /** Exposes the raw canvas for screenshot capture (F14) — CatEngine itself
   * has no opinion about screenshots; the caller (CatStage) owns when/why. */
  getCanvas(): HTMLCanvasElement | null {
    return this.app?.canvas ?? null;
  }

  destroy(): void {
    this.destroyed = true;
    window.removeEventListener("focus", this.handleWindowFocus);
    window.removeEventListener("blur", this.handleWindowBlur);
    window.removeEventListener("pointermove", this.handlePointerMove);
    window.removeEventListener("pointerup", this.handlePointerUp);
    this.visual?.destroy();
    this.app?.destroy(true, { children: true });
  }
}
