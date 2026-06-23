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
import { backend, emitEvent, listenEvent } from "@/lib/tauri";
import { useCat } from "@/hooks/useCat";
import { pickLine } from "@/engine/dialogue";
import { SpeechBubble, makeBubble, type BubbleMessage } from "@/components/cat/SpeechBubble";
import type { Achievement, Reminder, RareEventType } from "@/types/models";

interface ForegroundApp {
  process_name: string;
  window_title: string;
}
type AiToolKind = "chat_gpt" | "claude" | "gemini";
const AI_TOOL_LABEL: Record<AiToolKind, string> = { chat_gpt: "ChatGPT", claude: "Claude", gemini: "Gemini" };
const RARE_EVENT_LABEL: Record<RareEventType, string> = {
  golden_cat: "✨ Golden Cat!",
  ghost_cat: "👻 Ghost Cat!",
  ninja_cat: "🥷 Ninja Cat!",
};

export function CatStage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cursorRef = useRef<Vec2>({ x: 110, y: 110 });
  const engineRef = useRef<CatEngine | null>(null);
  const { cat, justLeveledUp, clearLevelUpFlag } = useCat();
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [bubble, setBubble] = useState<BubbleMessage | null>(null);
  const [captureTarget, setCaptureTarget] = useState<{ logId: number; eventType: RareEventType } | null>(null);
  const lastAiBubble = useRef<{ provider: AiToolKind | null; at: number }>({ provider: null, at: 0 });

  // --- PixiJS lifecycle: init on mount, destroy on unmount -----------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      cursorRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    window.addEventListener("pointermove", handlePointerMove);

    const handleDoubleClick = () => {
      void openHubWindow();
    };
    container.addEventListener("dblclick", handleDoubleClick);

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
      engineRef.current = instance;
    });

    return () => {
      cancelled = true;
      window.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("dblclick", handleDoubleClick);
      engineRef.current?.destroy();
      engineRef.current = null;
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

  useEffect(() => {
    if (justLeveledUp) {
      setBubble(makeBubble(pickLine(cat?.personality ?? "smart", "level_up"), { icon: "⭐", tone: "achievement" }));
    }
  }, [justLeveledUp, cat?.personality]);

  // --- F08 Smart Reminder: speak the (already-personalized) reminder body -
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listenEvent<Reminder>("reminder:due", (r) => {
      setBubble(makeBubble(r.body_template, { icon: "⏰", durationMs: 4500 }));
    }).then((u) => (unlisten = u));
    return () => unlisten?.();
  }, []);

  // --- F13 Achievement System -----------------------------------------------
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listenEvent<Achievement>("achievement:unlocked", (a) => {
      setBubble(makeBubble(`${a.title} unlocked! +${a.xp_reward} XP`, { icon: "🏆", tone: "achievement", durationMs: 4500 }));
    }).then((u) => (unlisten = u));
    return () => unlisten?.();
  }, []);

  // --- F09 Focus Guardian: personality-flavored nudge, non-blocking --------
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listenEvent<ForegroundApp>("focus:distraction_detected", () => {
      setBubble(makeBubble(pickLine(cat?.personality ?? "smart", "focus_guardian_nudge"), { icon: "👀", tone: "warning" }));
    }).then((u) => (unlisten = u));
    return () => unlisten?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat?.personality]);

  // --- F10 AI Presence Detection: client-side debounce, since the backend -
  // poll loop has no per-provider cooldown (it only debounces F09 nudges) —
  // without this, a bubble would re-fire every ~3s while ChatGPT/Claude/
  // Gemini stays in the foreground. See docs/roadmap.md for moving this
  // debounce server-side.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listenEvent<{ provider: AiToolKind; confidence: number }>("ai:presence_detected", (payload) => {
      const now = Date.now();
      const { provider, at } = lastAiBubble.current;
      if (provider === payload.provider && now - at < 60_000) return;
      lastAiBubble.current = { provider: payload.provider, at: now };
      setBubble(makeBubble(`Noticed you're in ${AI_TOOL_LABEL[payload.provider]}`, { icon: "💭", durationMs: 2600 }));
    }).then((u) => (unlisten = u));
    return () => unlisten?.();
  }, []);

  // --- F14 Rare Event Engine: sparkle bubble + offer a screenshot capture --
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listenEvent<RareEventType>("rare_event:triggered", (eventType) => {
      setBubble(makeBubble(RARE_EVENT_LABEL[eventType], { icon: "🌟", tone: "rare", durationMs: 6000 }));
      void backend.rareEventRecent(1).then((rows) => {
        if (rows[0]) {
          setCaptureTarget({ logId: rows[0].id, eventType });
          setTimeout(() => setCaptureTarget(null), 8000);
        }
      });
    }).then((u) => (unlisten = u));
    return () => unlisten?.();
  }, []);

  const handleCapture = async () => {
    const canvas = engineRef.current?.getCanvas();
    if (!canvas || !captureTarget) return;
    const dataUrl = canvas.toDataURL("image/png");
    const base64 = dataUrl.split(",")[1] ?? "";
    try {
      const path = await backend.rareEventCaptureScreenshot(captureTarget.logId, base64);
      setBubble(makeBubble(`Saved! ${path}`, { icon: "📸", durationMs: 3500 }));
    } catch (e) {
      console.error("Screenshot capture failed:", e);
    } finally {
      setCaptureTarget(null);
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      <SpeechBubble message={bubble} />
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
      {captureTarget && (
        <button
          onClick={() => void handleCapture()}
          style={{
            position: "absolute",
            bottom: 2,
            right: 2,
            border: "none",
            borderRadius: 999,
            width: 28,
            height: 28,
            fontSize: 14,
            cursor: "pointer",
            background: "rgba(168, 99, 245, 0.92)",
            color: "#fff",
            boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
          }}
          title="Save a screenshot of this rare event"
        >
          📸
        </button>
      )}
    </div>
  );
}

async function openHubWindow() {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
  const { Window } = await import("@tauri-apps/api/window");
  const hub = await Window.getByLabel("hub");
  await hub?.show();
  await hub?.setFocus();
}
