import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { backend } from "@/lib/tauri";
import { useCat } from "@/hooks/useCat";
import { useCatStore } from "@/state/catStore";
import { useSettingsStore } from "@/state/settingsStore";
import { theme, personalityColor } from "@/styles/theme";
import type { Personality } from "@/types/models";

const PERSONALITIES: Personality[] = ["lazy", "hyper", "smart", "clingy", "tsundere"];

export function SettingsPanel() {
  const { cat } = useCat();
  const setPersonality = useCatStore((s) => s.setPersonality);
  const rename = useCatStore((s) => s.rename);
  const settings = useSettingsStore((s) => s.settings);
  const loadSettings = useSettingsStore((s) => s.load);
  const updateSetting = useSettingsStore((s) => s.update);

  const [name, setName] = useState(cat?.name ?? "");
  const [distractionInput, setDistractionInput] = useState("");

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (cat?.name) setName(cat.name);
  }, [cat?.name]);

  const distractionPatterns = (settings.distraction_patterns as string[] | undefined) ?? [];
  const aiProvider = (settings.ai_provider_default as string | undefined) ?? "ollama";

  const addDistractionPattern = () => {
    const pattern = distractionInput.trim().toLowerCase();
    if (!pattern || distractionPatterns.includes(pattern)) return;
    void updateSetting("distraction_patterns", [...distractionPatterns, pattern]);
    setDistractionInput("");
  };
  const removeDistractionPattern = (pattern: string) => {
    void updateSetting("distraction_patterns", distractionPatterns.filter((p) => p !== pattern));
  };

  if (!cat) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: theme.space(7), maxWidth: 560 }}>
      <section>
        <h3 style={sectionTitleStyle}>Cat name</h3>
        <div style={{ display: "flex", gap: theme.space(2) }}>
          <input value={name} onChange={(e) => setName(e.target.value)} style={{ ...inputStyle, flex: 1 }} maxLength={32} />
          <button onClick={() => void rename(name)} disabled={!name.trim() || name === cat.name} style={primaryButtonStyle}>
            Save
          </button>
        </div>
      </section>

      <section>
        <h3 style={sectionTitleStyle}>Personality</h3>
        <p style={{ fontSize: 12, color: theme.color.textMuted, margin: `0 0 ${theme.space(3)} 0` }}>
          Shapes how Comnyang reacts to focus sessions, reminders, and distractions.
        </p>
        <div style={{ display: "flex", gap: theme.space(2), flexWrap: "wrap" }}>
          {PERSONALITIES.map((p) => (
            <button
              key={p}
              onClick={() => void setPersonality(p)}
              style={{
                padding: `${theme.space(2)} ${theme.space(4)}`,
                borderRadius: theme.radius.md,
                border: `2px solid ${p === cat.personality ? personalityColor[p] : theme.color.border}`,
                background: p === cat.personality ? personalityColor[p] : theme.color.surfaceRaised,
                color: p === cat.personality ? theme.color.accentText : theme.color.text,
                fontSize: 13,
                fontWeight: 600,
                textTransform: "capitalize",
                cursor: "pointer",
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 style={sectionTitleStyle}>Focus Guardian — distraction patterns</h3>
        <p style={{ fontSize: 12, color: theme.color.textMuted, margin: `0 0 ${theme.space(3)} 0` }}>
          During a focus session, Comnyang gives a friendly nudge if your foreground window matches one of these (it never blocks anything).
        </p>
        <div style={{ display: "flex", gap: theme.space(2), marginBottom: theme.space(3) }}>
          <input
            value={distractionInput}
            onChange={(e) => setDistractionInput(e.target.value)}
            placeholder="e.g. reddit.com"
            style={{ ...inputStyle, flex: 1 }}
            onKeyDown={(e) => e.key === "Enter" && addDistractionPattern()}
          />
          <button onClick={addDistractionPattern} style={primaryButtonStyle}>
            Add
          </button>
        </div>
        <div style={{ display: "flex", gap: theme.space(2), flexWrap: "wrap" }}>
          {distractionPatterns.map((p) => (
            <span
              key={p}
              style={{
                padding: `${theme.space(1)} ${theme.space(3)}`,
                borderRadius: 999,
                background: theme.color.surfaceRaised,
                fontSize: 12,
                color: theme.color.text,
                display: "flex",
                alignItems: "center",
                gap: theme.space(2),
              }}
            >
              {p}
              <button
                onClick={() => removeDistractionPattern(p)}
                style={{ border: "none", background: "none", color: theme.color.textMuted, cursor: "pointer", padding: 0, fontSize: 13 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </section>

      <section>
        <h3 style={sectionTitleStyle}>AI provider</h3>
        <p style={{ fontSize: 12, color: theme.color.textMuted, margin: `0 0 ${theme.space(3)} 0` }}>
          Used for AI-enhanced Daily Stories. Ollama runs locally and needs no API key; the others require a key stored in your OS keychain.
        </p>
        <select
          value={aiProvider}
          onChange={(e) => void updateSetting("ai_provider_default", e.target.value)}
          style={{ ...inputStyle, width: 200 }}
        >
          <option value="ollama">Ollama (local, free)</option>
          <option value="openai">OpenAI</option>
          <option value="claude">Claude</option>
          <option value="gemini">Gemini</option>
        </select>
        {aiProvider !== "ollama" && <ApiKeyField provider={aiProvider} />}
      </section>

      <section>
        <h3 style={sectionTitleStyle}>Plan</h3>
        <div
          style={{
            display: "inline-block",
            padding: `${theme.space(2)} ${theme.space(4)}`,
            borderRadius: theme.radius.md,
            background: cat.tier === "pro" ? theme.color.accent : theme.color.surfaceRaised,
            color: cat.tier === "pro" ? theme.color.accentText : theme.color.textMuted,
            fontSize: 13,
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          {cat.tier}
        </div>
      </section>
    </div>
  );
}

function ApiKeyField({ provider }: { provider: string }) {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHasKey(null);
    void backend.aiProviderHasKey(provider).then(setHasKey);
  }, [provider]);

  const handleSave = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await backend.aiProviderSetKey(provider, draft.trim());
      setDraft("");
      setHasKey(true);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    await backend.aiProviderDeleteKey(provider);
    setHasKey(false);
  };

  return (
    <div style={{ marginTop: theme.space(3), display: "flex", gap: theme.space(2), alignItems: "center" }}>
      {hasKey ? (
        <>
          <span style={{ fontSize: 12, color: theme.color.success }}>✓ API key configured</span>
          <button onClick={() => void handleRemove()} style={{ ...primaryButtonStyle, background: theme.color.surfaceRaised, color: theme.color.text }}>
            Remove
          </button>
        </>
      ) : (
        <>
          <input
            type="password"
            placeholder="Paste API key..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={() => void handleSave()} disabled={!draft.trim() || saving} style={primaryButtonStyle}>
            {saving ? "Saving..." : "Save"}
          </button>
        </>
      )}
    </div>
  );
}

const sectionTitleStyle: CSSProperties = { fontSize: 14, color: theme.color.text, fontWeight: 700, margin: `0 0 ${theme.space(2)} 0` };
const inputStyle: CSSProperties = {
  padding: `${theme.space(2)} ${theme.space(3)}`,
  borderRadius: theme.radius.sm,
  border: `1px solid ${theme.color.border}`,
  background: theme.color.surfaceRaised,
  color: theme.color.text,
  fontSize: 13,
  outline: "none",
};
const primaryButtonStyle: CSSProperties = {
  padding: `${theme.space(2)} ${theme.space(4)}`,
  borderRadius: theme.radius.md,
  border: "none",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  background: theme.color.accent,
  color: theme.color.accentText,
};
