// Minimal design tokens for the Companion Hub. The pet window stays
// Pixi-only + a couple of inline-styled DOM overlays (CatStage.tsx,
// SpeechBubble.tsx); the Hub is a real dashboard surface, so it gets its
// own token set rather than scattering magic hex values across six panel
// files.

export const theme = {
  color: {
    bg: "#1b1712",
    surface: "#241f18",
    surfaceRaised: "#2c2620",
    border: "#3a3228",
    text: "#f5ede1",
    textMuted: "#b8ab97",
    accent: "#f5c16c",
    accentText: "#3a2a14",
    success: "#7fb069",
    danger: "#d97a8a",
    info: "#7ab8d9",
    rare: "#a863f5",
  },
  radius: { sm: 6, md: 10, lg: 16 },
  space: (n: number) => `${n * 4}px`,
} as const;

export const personalityColor: Record<string, string> = {
  lazy: "#9c9c9c",
  hyper: "#f5916c",
  smart: "#7ab8d9",
  clingy: "#d97ab0",
  tsundere: "#f5c16c",
};

export const moodEmoji: Record<string, string> = {
  happy: "😊",
  focused: "🎯",
  sleepy: "😴",
  curious: "🧐",
  hungry: "🍖",
  lonely: "🥺",
};
