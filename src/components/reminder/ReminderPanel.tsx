import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useReminderStore } from "@/state/reminderStore";
import { theme } from "@/styles/theme";
import type { RepeatRulePayload, RepeatRuleType } from "@/types/models";

function nextFireFromTimeString(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  const now = new Date();
  const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
  if (candidate.getTime() <= now.getTime()) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return Math.floor(candidate.getTime() / 1000);
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ReminderPanel() {
  const reminders = useReminderStore((s) => s.reminders);
  const load = useReminderStore((s) => s.load);
  const create = useReminderStore((s) => s.create);
  const update = useReminderStore((s) => s.update);
  const remove = useReminderStore((s) => s.remove);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("Hey {name}, time for a quick break.");
  const [time, setTime] = useState("09:00");
  const [repeatType, setRepeatType] = useState<RepeatRuleType>("daily");
  const [customDays, setCustomDays] = useState<number[]>([1, 2, 3, 4, 5]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    const rule: RepeatRulePayload =
      repeatType === "custom" ? { type: "custom", days_of_week: customDays } : { type: repeatType };
    await create(title.trim(), body.trim(), rule, nextFireFromTimeString(time));
    setTitle("");
  };

  const toggleDay = (day: number) => {
    setCustomDays((d) => (d.includes(day) ? d.filter((x) => x !== day) : [...d, day].sort()));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: theme.space(6) }}>
      <section
        style={{
          background: theme.color.surface,
          border: `1px solid ${theme.color.border}`,
          borderRadius: theme.radius.lg,
          padding: theme.space(5),
          display: "flex",
          flexDirection: "column",
          gap: theme.space(3),
        }}
      >
        <h3 style={{ margin: 0, fontSize: 14, color: theme.color.textMuted, fontWeight: 600 }}>New reminder</h3>
        <input
          placeholder="Title (e.g. Drink water)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={inputStyle}
        />
        <input
          placeholder="Message — use {name} for Comnyang's name"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          style={inputStyle}
        />
        <div style={{ display: "flex", gap: theme.space(3), alignItems: "center", flexWrap: "wrap" }}>
          <label style={labelStyle}>
            Time{" "}
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ ...inputStyle, width: 110 }} />
          </label>
          <label style={labelStyle}>
            Repeat{" "}
            <select
              value={repeatType}
              onChange={(e) => setRepeatType(e.target.value as RepeatRuleType)}
              style={{ ...inputStyle, width: 130 }}
            >
              <option value="none">Once</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="custom">Custom days</option>
            </select>
          </label>
        </div>
        {repeatType === "custom" && (
          <div style={{ display: "flex", gap: theme.space(1) }}>
            {WEEKDAY_LABELS.map((label, idx) => (
              <button
                key={idx}
                onClick={() => toggleDay(idx)}
                style={{
                  padding: `${theme.space(1)} ${theme.space(2)}`,
                  borderRadius: theme.radius.sm,
                  border: "none",
                  fontSize: 12,
                  cursor: "pointer",
                  background: customDays.includes(idx) ? theme.color.accent : theme.color.surfaceRaised,
                  color: customDays.includes(idx) ? theme.color.accentText : theme.color.textMuted,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <div>
          <button
            onClick={() => void handleCreate()}
            disabled={!title.trim()}
            style={{
              padding: `${theme.space(2)} ${theme.space(4)}`,
              borderRadius: theme.radius.md,
              border: "none",
              fontSize: 13,
              fontWeight: 600,
              cursor: title.trim() ? "pointer" : "not-allowed",
              opacity: title.trim() ? 1 : 0.5,
              background: theme.color.accent,
              color: theme.color.accentText,
            }}
          >
            Create reminder
          </button>
        </div>
      </section>

      <section>
        <h3 style={{ fontSize: 14, color: theme.color.textMuted, margin: `0 0 ${theme.space(2)} 0`, fontWeight: 600 }}>
          Your reminders
        </h3>
        {reminders.length === 0 ? (
          <p style={{ color: theme.color.textMuted, fontSize: 13 }}>No reminders yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: theme.space(2) }}>
            {reminders.map((r) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: theme.space(3),
                  background: theme.color.surface,
                  borderRadius: theme.radius.md,
                  opacity: r.is_active ? 1 : 0.5,
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: theme.color.text }}>{r.title}</div>
                  <div style={{ fontSize: 12, color: theme.color.textMuted }}>
                    {r.body_template} · {r.repeat_rule} · next {new Date(r.next_fire_at * 1000).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: "flex", gap: theme.space(2) }}>
                  <button
                    onClick={() => void update(r.id, { isActive: !r.is_active })}
                    style={iconButtonStyle}
                    title={r.is_active ? "Pause" : "Resume"}
                  >
                    {r.is_active ? "⏸" : "▶"}
                  </button>
                  <button onClick={() => void remove(r.id)} style={iconButtonStyle} title="Delete">
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const inputStyle: CSSProperties = {
  padding: `${theme.space(2)} ${theme.space(3)}`,
  borderRadius: theme.radius.sm,
  border: `1px solid ${theme.color.border}`,
  background: theme.color.surfaceRaised,
  color: theme.color.text,
  fontSize: 13,
  outline: "none",
};
const labelStyle: CSSProperties = { fontSize: 12, color: theme.color.textMuted, display: "flex", alignItems: "center", gap: theme.space(1) };
const iconButtonStyle: CSSProperties = {
  border: "none",
  background: theme.color.surfaceRaised,
  borderRadius: theme.radius.sm,
  padding: `${theme.space(1)} ${theme.space(2)}`,
  cursor: "pointer",
  fontSize: 13,
};
