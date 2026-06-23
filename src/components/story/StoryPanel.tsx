import { useEffect, useState } from "react";
import { backend } from "@/lib/tauri";
import { useCat } from "@/hooks/useCat";
import { theme } from "@/styles/theme";
import type { DailyStory } from "@/types/models";

const STORY_ICON: Record<DailyStory["story_type"], string> = { dream: "💤", adventure: "🗺️", funny: "😹" };

export function StoryPanel() {
  const { cat } = useCat();
  const [story, setStory] = useState<DailyStory | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    void backend.storyGetToday().then((s) => {
      setStory(s);
      setLoading(false);
    });
  }, []);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const s = await backend.storyRegenerate();
      setStory(s);
    } catch (e) {
      console.error("Story regenerate failed (likely not Pro tier):", e);
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return <p style={{ color: theme.color.textMuted, fontSize: 13 }}>Comnyang is still dreaming this one up...</p>;
  }
  if (!story) {
    return <p style={{ color: theme.color.textMuted, fontSize: 13 }}>No story yet today.</p>;
  }

  return (
    <div
      style={{
        background: theme.color.surface,
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.lg,
        padding: theme.space(6),
        maxWidth: 560,
      }}
    >
      <div style={{ fontSize: 13, color: theme.color.textMuted, marginBottom: theme.space(2) }}>
        {STORY_ICON[story.story_type]} {story.story_date} · {story.story_type}
      </div>
      <p style={{ fontSize: 16, lineHeight: 1.6, color: theme.color.text, margin: 0 }}>{story.content}</p>
      {cat?.tier === "pro" && (
        <button
          onClick={() => void handleRegenerate()}
          disabled={regenerating}
          style={{
            marginTop: theme.space(4),
            padding: `${theme.space(2)} ${theme.space(4)}`,
            borderRadius: theme.radius.md,
            border: "none",
            fontSize: 13,
            fontWeight: 600,
            cursor: regenerating ? "default" : "pointer",
            opacity: regenerating ? 0.6 : 1,
            background: theme.color.surfaceRaised,
            color: theme.color.text,
          }}
        >
          {regenerating ? "Dreaming up a new one..." : "✨ Regenerate (Pro)"}
        </button>
      )}
    </div>
  );
}
