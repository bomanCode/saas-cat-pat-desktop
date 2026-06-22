// Single transient-message overlay used by CatStage to surface every
// event that should visibly react on the pet (F08 reminders, F09 focus
// nudges, F10 AI presence, F13 achievements, F14 rare events) — see
// module doc in CatStage.tsx for why this lives as a plain queued DOM
// overlay rather than inside CatEngine/Pixi.

import { useEffect, useState } from "react";

export interface BubbleMessage {
  id: number;
  text: string;
  icon?: string;
  tone?: "default" | "achievement" | "rare" | "warning";
  durationMs?: number;
}

let seq = 0;
export function makeBubble(text: string, opts: Partial<Omit<BubbleMessage, "id" | "text">> = {}): BubbleMessage {
  return { id: ++seq, text, durationMs: 3200, tone: "default", ...opts };
}

const TONE_BG: Record<NonNullable<BubbleMessage["tone"]>, string> = {
  default: "rgba(40, 32, 20, 0.92)",
  achievement: "rgba(245, 193, 108, 0.96)",
  rare: "rgba(168, 99, 245, 0.94)",
  warning: "rgba(217, 122, 138, 0.94)",
};
const TONE_FG: Record<NonNullable<BubbleMessage["tone"]>, string> = {
  default: "#fdf6ec",
  achievement: "#3a2a14",
  rare: "#ffffff",
  warning: "#2a1418",
};

export function SpeechBubble({ message }: { message: BubbleMessage | null }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), message.durationMs ?? 3200);
    return () => clearTimeout(t);
  }, [message]);

  if (!message || !visible) return null;
  const tone = message.tone ?? "default";

  return (
    <div
      style={{
        position: "absolute",
        bottom: "78%",
        left: "50%",
        transform: "translateX(-50%)",
        maxWidth: 190,
        padding: "6px 10px",
        borderRadius: 12,
        background: TONE_BG[tone],
        color: TONE_FG[tone],
        fontSize: 11.5,
        lineHeight: 1.3,
        textAlign: "center",
        pointerEvents: "none",
        boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
        whiteSpace: "normal",
      }}
    >
      {message.icon && <span style={{ marginRight: 4 }}>{message.icon}</span>}
      {message.text}
    </div>
  );
}
