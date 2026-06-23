import { useEffect } from "react";
import { useAchievementStore } from "@/state/achievementStore";
import { theme } from "@/styles/theme";

export function AchievementPanel() {
  const achievements = useAchievementStore((s) => s.achievements);
  const load = useAchievementStore((s) => s.load);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: theme.space(3),
      }}
    >
      {achievements.map((a) => {
        const pct = Math.round((a.progress / a.achievement.rule_target) * 100);
        return (
          <div
            key={a.achievement.id}
            style={{
              background: theme.color.surface,
              border: `1px solid ${a.unlocked ? theme.color.accent : theme.color.border}`,
              borderRadius: theme.radius.lg,
              padding: theme.space(4),
              opacity: a.unlocked ? 1 : 0.75,
            }}
          >
            <div style={{ fontSize: 28, marginBottom: theme.space(2) }}>{a.unlocked ? "🏆" : "🔒"}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: theme.color.text, marginBottom: 2 }}>{a.achievement.title}</div>
            <div style={{ fontSize: 12, color: theme.color.textMuted, marginBottom: theme.space(3) }}>
              {a.achievement.description}
            </div>
            <div style={{ height: 5, borderRadius: 999, background: theme.color.surfaceRaised, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: a.unlocked ? theme.color.success : theme.color.accent,
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: theme.color.textMuted, marginTop: theme.space(1), display: "flex", justifyContent: "space-between" }}>
              <span>
                {a.progress} / {a.achievement.rule_target}
              </span>
              <span style={{ color: theme.color.accent }}>+{a.achievement.xp_reward} XP</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AchievementToast() {
  const recentlyUnlocked = useAchievementStore((s) => s.recentlyUnlocked);
  const dismiss = useAchievementStore((s) => s.dismissToast);

  useEffect(() => {
    if (!recentlyUnlocked) return;
    const t = setTimeout(dismiss, 4000);
    return () => clearTimeout(t);
  }, [recentlyUnlocked, dismiss]);

  if (!recentlyUnlocked) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: theme.space(5),
        right: theme.space(5),
        background: theme.color.accent,
        color: theme.color.accentText,
        borderRadius: theme.radius.lg,
        padding: `${theme.space(3)} ${theme.space(4)}`,
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        gap: theme.space(2),
        zIndex: 1000,
      }}
    >
      <span style={{ fontSize: 22 }}>🏆</span>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13 }}>Achievement unlocked!</div>
        <div style={{ fontSize: 12 }}>{recentlyUnlocked.title} · +{recentlyUnlocked.xp_reward} XP</div>
      </div>
    </div>
  );
}
