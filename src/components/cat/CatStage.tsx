// React <-> PixiJS integration layer (Phase 1, "CatStage React Integration
// Layer"). This is the ONLY React component that touches CatEngine.
//
// Design constraint (architecture.md §4, §10): Pixi's own ticker must drive
// animation, not React re-renders. So this component does two genuinely
// different things and keeps them separate:
//
//  1. Lifecycle: mount CatEngine into a plain div on mount, destroy it on
//     unmount. This is the only "React-driven" part.
//  2. Per-frame data: cursor position and current mood are read live via
//     refs / `store.getState()` inside CatEngine's own tick callback — never
//     through component props or state, so mood/cat-store updates do NOT
//     trigger a re-render of this component or a re-init of the canvas.
//
// A thin DOM overlay (level-up badge) sits on top of the canvas and *does*
// use normal React state — that's fine, it's a separate DOM layer the
// architecture doc explicitly carves out ("React ... reflects state for UI
// overlays (speech bubbles, mood icon)").

import { useEffect, useRef, useState } from "react";
import { CatEngine } from "@/engine/CatEngine";
import type { Vec2 } from "@/engine/eyeFollow";
import { useMoodStore } from "@/state/moodStore";
import { emitEvent } from "@/lib/tauri";
import { useCat } from "@/hooks/useCat";

export function CatStage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cursorRef = useRef<Vec2>({ x: 110, y: 110 });
  const { cat, justLeveledUp, clearLevelUpFlag } = useCat();
  const [showLevelUp, setShowLevelUp] = useState(false);

  // --- PixiJS lifecycle: init on mount, destroy on unmount -----------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let engine: CatEngine | null = null;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      cursorRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    window.addEventListener("pointermove", handlePointerMove);

    const instance = new CatEngine(container, {
      getCursorWorldPos: () => cursorRef.current,
      // Non-reactive read: bypasses React, so mood changes never force a
      // re-render/re-init of the canvas — only the next tick picks it up.
      getMood: () => useMoodStore.getState().mood,
      onInteraction: () => emitEvent("pet:interaction"),
    });

    void instance.init().then(() => {
      if (cancelled) {
        // Unmounted (e.g. StrictMode's dev-only double-invoke) before init
        // resolved — tear down immediately instead of leaking a canvas.
        instance.destroy();
        return;
      }
      engine = instance;
    });

    return () => {
      cancelled = true;
      window.removeEventListener("pointermove", handlePointerMove);
      engine?.destroy();
    };
  }, []);

  // --- UI overlay: level-up badge, driven by normal React state -----------
  useEffect(() => {
    if (!justLeveledUp) return;
    setShowLevelUp(true);
    clearLevelUpFlag();
    const t = setTimeout(() => setShowLevelUp(false), 2200);
    return () => clearTimeout(t);
  }, [justLeveledUp, clearLevelUpFlag]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      {showLevelUp && cat && (
        <div
          style={{
            position: "absolute",
            top: 4,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "2px 10px",
            borderRadius: 999,
            background: "rgba(245, 193, 108, 0.95)",
            color: "#3a2a14",
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          Level {cat.level}!
        </div>
      )}
    </div>
  );
}
