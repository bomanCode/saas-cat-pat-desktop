import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { useMemoryVaultStore } from "@/state/memoryVaultStore";
import { theme } from "@/styles/theme";
import type { AiMemoryKind, AiSourceProvider } from "@/types/models";

const KIND_ICON: Record<AiMemoryKind, string> = { prompt: "💬", response: "🤖", snippet: "📋" };

export function MemoryVaultPanel() {
  const entries = useMemoryVaultStore((s) => s.entries);
  const query = useMemoryVaultStore((s) => s.query);
  const tags = useMemoryVaultStore((s) => s.tags);
  const activeTag = useMemoryVaultStore((s) => s.activeTag);
  const setQuery = useMemoryVaultStore((s) => s.setQuery);
  const setActiveTag = useMemoryVaultStore((s) => s.setActiveTag);
  const search = useMemoryVaultStore((s) => s.search);
  const save = useMemoryVaultStore((s) => s.save);
  const remove = useMemoryVaultStore((s) => s.remove);
  const loadTags = useMemoryVaultStore((s) => s.loadTags);

  const [newContent, setNewContent] = useState("");
  const [newKind, setNewKind] = useState<AiMemoryKind>("snippet");
  const [newProvider, setNewProvider] = useState<AiSourceProvider>("manual");
  const [newTags, setNewTags] = useState("");

  useEffect(() => {
    void search();
    void loadTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void search();
  }, [query, activeTag, search]);

  const handleSave = async () => {
    if (!newContent.trim()) return;
    const tagList = newTags.split(",").map((t) => t.trim()).filter(Boolean);
    await save(newKind, newContent.trim(), newProvider, tagList);
    setNewContent("");
    setNewTags("");
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
        <h3 style={{ margin: 0, fontSize: 14, color: theme.color.textMuted, fontWeight: 600 }}>Save something</h3>
        <textarea
          placeholder="Paste a prompt, response, or code snippet worth keeping..."
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
        />
        <div style={{ display: "flex", gap: theme.space(3), flexWrap: "wrap" }}>
          <select value={newKind} onChange={(e) => setNewKind(e.target.value as AiMemoryKind)} style={{ ...inputStyle, width: 120 }}>
            <option value="snippet">Snippet</option>
            <option value="prompt">Prompt</option>
            <option value="response">Response</option>
          </select>
          <select
            value={newProvider}
            onChange={(e) => setNewProvider(e.target.value as AiSourceProvider)}
            style={{ ...inputStyle, width: 140 }}
          >
            <option value="manual">Manual</option>
            <option value="openai">ChatGPT</option>
            <option value="claude">Claude</option>
            <option value="gemini">Gemini</option>
            <option value="ollama">Ollama</option>
          </select>
          <input
            placeholder="tags, comma-separated"
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: 160 }}
          />
        </div>
        <div>
          <button onClick={() => void handleSave()} disabled={!newContent.trim()} style={primaryButtonStyle(!!newContent.trim())}>
            Save to vault
          </button>
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: theme.space(3) }}>
        <div style={{ display: "flex", gap: theme.space(2), alignItems: "center" }}>
          <input
            placeholder="Search your vault..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          />
          {tags.length > 0 && (
            <select
              value={activeTag ?? ""}
              onChange={(e) => setActiveTag(e.target.value || null)}
              style={{ ...inputStyle, width: 140 }}
            >
              <option value="">All tags</option>
              {tags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </div>

        {entries.length === 0 ? (
          <p style={{ color: theme.color.textMuted, fontSize: 13 }}>
            Nothing here yet — save a prompt or snippet above to get started.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: theme.space(2) }}>
            {entries.map((e) => (
              <div
                key={e.id}
                style={{
                  padding: theme.space(3),
                  background: theme.color.surface,
                  borderRadius: theme.radius.md,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: theme.space(3),
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: theme.color.textMuted, marginBottom: 2 }}>
                    {KIND_ICON[e.kind]} {e.kind}
                    {e.source_provider && e.source_provider !== "manual" ? ` · ${e.source_provider}` : ""}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: theme.color.text,
                      whiteSpace: "pre-wrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {e.content}
                  </div>
                </div>
                <button onClick={() => void remove(e.id)} style={iconButtonStyle} title="Delete">
                  🗑
                </button>
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
const iconButtonStyle: CSSProperties = {
  border: "none",
  background: theme.color.surfaceRaised,
  borderRadius: theme.radius.sm,
  padding: `${theme.space(1)} ${theme.space(2)}`,
  cursor: "pointer",
  fontSize: 13,
  flexShrink: 0,
  height: "fit-content",
};
function primaryButtonStyle(enabled: boolean): CSSProperties {
  return {
    padding: `${theme.space(2)} ${theme.space(4)}`,
    borderRadius: theme.radius.md,
    border: "none",
    fontSize: 13,
    fontWeight: 600,
    cursor: enabled ? "pointer" : "not-allowed",
    opacity: enabled ? 1 : 0.5,
    background: theme.color.accent,
    color: theme.color.accentText,
  };
}
