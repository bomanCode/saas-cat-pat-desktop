import { useEffect } from "react";
import { usePomodoroStore } from "@/state/pomodoroStore";
import { theme } from "@/styles/theme";
import type { PomodoroSession } from "@/types/models";

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatClock(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const STATUS_COLOR: Record<PomodoroSession["status"], string> = {
  completed: theme.color.success,
  running: theme.color.info,
  paused: theme.color.accent,
  abandoned: theme.color.danger,
};

export function PomodoroPanel() {
  const session = usePomodoroStore((s) => s.session);
  const remainingSeconds = usePomodoroStore((s) => s.remainingSeconds);
  const history = usePomodoroStore((s) => s.history);
  const start = usePomodoroStore((s) => s.start);
  const pause = usePomodoroStore((s) => s.pause);
  const resume = usePomodoroStore((s) => s.resume);
  const stop = usePomodoroStore((s) => s.stop);
  const loadHistory = usePomodoroStore((s) => s.loadHistory);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const isRunning = session?.status === "running";
  const isPaused = session?.status === "paused";
  const progressPct = session ? Math.round(((session.planned_seconds - remainingSeconds) / session.planned_seconds) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: theme.space(6) }}>
      <section
        style={{
          background: theme.color.surface,
          border: `1px solid ${theme.color.border}`,
          borderRadius: theme.radius.lg,
          padding: theme.space(6),
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 13, color: theme.color.textMuted, marginBottom: 4 }}>
          {session ? (session.phase === "focus" ? "Focus session" : "Break") : "Ready when you are"}
        </div>
        <div style={{ fontSize: 56, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: theme.color.text }}>
          {session ? formatTime(remainingSeconds) : "25:00"}
        </div>

        {session && (
          <div
            style={{
              height: 6,
              borderRadius: 999,
              background: theme.color.surfaceRaised,
              overflow: "hidden",
              margin: `${theme.space(3)} auto 0`,
              maxWidth: 320,
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progressPct}%`,
                background: theme.color.accent,
                transition: "width 1s linear",
              }}
            />
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "center", gap: theme.space(2), marginTop: theme.space(5) }}>
          {!session && (
            <>
              <Button label="Start Focus (25m)" onClick={() => void start("focus")} primary />
              <Button label="Start Break (5m)" onClick={() => void start("break")} />
            </>
          )}
          {isRunning && (
            <>
              <Button label="Pause" onClick={() => void pause()} />
              <Button label="Stop" onClick={() => void stop()} danger />
            </>
          )}
          {isPaused && (
            <>
              <Button label="Resume" onClick={() => void resume()} primary />
              <Button label="Stop" onClick={() => void stop()} danger />
            </>
          )}
        </div>
      </section>

      <section>
        <h3 style={{ fontSize: 14, color: theme.color.textMuted, margin: `0 0 ${theme.space(2)} 0`, fontWeight: 600 }}>
          Session history
        </h3>
        {history.length === 0 ? (
          <p style={{ color: theme.color.textMuted, fontSize: 13 }}>No sessions yet — start your first focus block above.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: theme.space(1) }}>
            {history.slice(0, 20).map((s) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: `${theme.space(2)} ${theme.space(3)}`,
                  background: theme.color.surface,
                  borderRadius: theme.radius.sm,
                  fontSize: 13,
                }}
              >
                <span style={{ color: theme.color.text }}>
                  {s.phase === "focus" ? "🎯 Focus" : "☕ Break"} · {formatClock(s.started_at)}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: theme.space(2) }}>
                  {s.xp_awarded > 0 && <span style={{ color: theme.color.accent }}>+{s.xp_awarded} XP</span>}
                  <span style={{ color: STATUS_COLOR[s.status], fontWeight: 600, textTransform: "capitalize" }}>
                    {s.status}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Button({
  label,
  onClick,
  primary,
  danger,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: `${theme.space(2)} ${theme.space(4)}`,
        borderRadius: theme.radius.md,
        border: "none",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        background: danger ? theme.color.danger : primary ? theme.color.accent : theme.color.surfaceRaised,
        color: danger ? "#fff" : primary ? theme.color.accentText : theme.color.text,
      }}
    >
      {label}
    </button>
  );
}
