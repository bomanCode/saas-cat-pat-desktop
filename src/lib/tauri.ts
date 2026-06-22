// Thin typed wrapper around @tauri-apps/api `invoke`, matching the command
// contract in docs/specification.md §5. Falls back to an in-memory mock
// when not running inside Tauri (e.g. `npm run dev` in a plain browser for
// fast UI iteration) — see `mockBackend` below. This keeps every component
// invoke-call-compatible whether or not the Rust backend is attached.

import type {
  Achievement,
  AchievementWithProgress,
  AiMemoryEntry,
  AiMemoryKind,
  AiSourceProvider,
  CatState,
  DailyStory,
  Personality,
  PomodoroPhase,
  PomodoroSession,
  RareEventLogRow,
  Reminder,
  RepeatRulePayload,
  XpAwardResponse,
  XpSource,
} from "@/types/models";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function invokeReal<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

export const backend = {
  async catGetState(): Promise<CatState> {
    return isTauri() ? invokeReal("cat_get_state") : mock.catGetState();
  },
  async catSetPersonality(personality: Personality): Promise<CatState> {
    return isTauri()
      ? invokeReal("cat_set_personality", { personality })
      : mock.catSetPersonality(personality);
  },
  async catRename(name: string): Promise<CatState> {
    return isTauri() ? invokeReal("cat_rename", { name }) : mock.catRename(name);
  },
  async xpAward(source: XpSource, amount?: number): Promise<XpAwardResponse> {
    return isTauri() ? invokeReal("xp_award", { source, amount }) : mock.xpAward(source, amount);
  },

  async pomodoroStart(phase: PomodoroPhase, plannedSeconds: number): Promise<PomodoroSession> {
    return isTauri()
      ? invokeReal("pomodoro_start", { phase, plannedSeconds })
      : mock.pomodoroStart(phase, plannedSeconds);
  },
  async pomodoroPause(sessionId: number): Promise<PomodoroSession> {
    return isTauri() ? invokeReal("pomodoro_pause", { sessionId }) : mock.pomodoroPause(sessionId);
  },
  async pomodoroResume(sessionId: number): Promise<PomodoroSession> {
    return isTauri() ? invokeReal("pomodoro_resume", { sessionId }) : mock.pomodoroResume(sessionId);
  },
  async pomodoroComplete(
    sessionId: number,
    actualSeconds: number,
  ): Promise<{ session: PomodoroSession; xp_awarded: number }> {
    return isTauri()
      ? invokeReal("pomodoro_complete", { sessionId, actualSeconds })
      : mock.pomodoroComplete(sessionId, actualSeconds);
  },
  async pomodoroHistory(from?: number, to?: number): Promise<PomodoroSession[]> {
    return isTauri() ? invokeReal("pomodoro_history", { from, to }) : mock.pomodoroHistory();
  },

  async reminderCreate(
    title: string,
    bodyTemplate: string,
    repeatRule: RepeatRulePayload,
    firstFireAt: number,
  ): Promise<Reminder> {
    return isTauri()
      ? invokeReal("reminder_create", { title, bodyTemplate, repeatRule, firstFireAt })
      : mock.reminderCreate(title, bodyTemplate, repeatRule, firstFireAt);
  },
  async reminderList(): Promise<Reminder[]> {
    return isTauri() ? invokeReal("reminder_list") : mock.reminderList();
  },
  async reminderUpdate(
    id: number,
    patch: { title?: string; bodyTemplate?: string; isActive?: boolean },
  ): Promise<Reminder> {
    return isTauri() ? invokeReal("reminder_update", { id, ...patch }) : mock.reminderUpdate(id, patch);
  },
  async reminderDelete(id: number): Promise<void> {
    return isTauri() ? invokeReal("reminder_delete", { id }) : mock.reminderDelete(id);
  },

  async memorySave(
    kind: AiMemoryKind,
    content: string,
    sourceProvider?: AiSourceProvider,
    tags?: string[],
  ): Promise<AiMemoryEntry> {
    return isTauri()
      ? invokeReal("memory_save", { kind, content, sourceProvider, tags })
      : mock.memorySave(kind, content, sourceProvider, tags);
  },
  async memorySearch(query: string, tag?: string): Promise<AiMemoryEntry[]> {
    return isTauri() ? invokeReal("memory_search", { query, tag }) : mock.memorySearch(query, tag);
  },
  async memoryDelete(id: number): Promise<void> {
    return isTauri() ? invokeReal("memory_delete", { id }) : mock.memoryDelete(id);
  },
  async memoryListTags(): Promise<string[]> {
    return isTauri() ? invokeReal("memory_list_tags") : mock.memoryListTags();
  },

  async achievementList(): Promise<AchievementWithProgress[]> {
    return isTauri() ? invokeReal("achievement_list") : mock.achievementList();
  },

  async storyGetToday(): Promise<DailyStory> {
    return isTauri() ? invokeReal("story_get_today") : mock.storyGetToday();
  },
  async storyRegenerate(): Promise<DailyStory> {
    return isTauri() ? invokeReal("story_regenerate") : mock.storyGetToday();
  },

  async rareEventRecent(limit: number): Promise<RareEventLogRow[]> {
    return isTauri() ? invokeReal("rare_event_recent", { limit }) : mock.rareEventRecent();
  },
  /** Sends a captured canvas frame (base64 PNG, no data: prefix) to the
   * backend, which writes it to the Pictures/Comnyang folder and records
   * the path against the rare event log row. Returns the saved file path. */
  async rareEventCaptureScreenshot(logId: number, base64Png: string): Promise<string> {
    return isTauri()
      ? invokeReal("rare_event_capture_screenshot", { logId, base64Png })
      : mock.rareEventCaptureScreenshot(logId, base64Png);
  },

  async settingsGet(): Promise<Record<string, unknown>> {
    return isTauri() ? invokeReal("settings_get") : mock.settingsGet();
  },
  async settingsUpdate(key: string, value: unknown): Promise<void> {
    return isTauri() ? invokeReal("settings_update", { key, value }) : mock.settingsUpdate(key, value);
  },
};

/** Subscribes to a Tauri-emitted event; no-ops outside Tauri. Returns an unsubscribe fn. */
export async function listenEvent<T>(name: string, handler: (payload: T) => void): Promise<() => void> {
  if (!isTauri()) return () => {};
  const { listen } = await import("@tauri-apps/api/event");
  const unlisten = await listen<T>(name, (e) => handler(e.payload));
  return unlisten;
}

/** Fire-and-forget emit to the Rust backend; no-ops outside Tauri. */
export function emitEvent<T>(name: string, payload?: T): void {
  if (!isTauri()) return;
  void import("@tauri-apps/api/event").then(({ emit }) => emit(name, payload));
}

// ---------------------------------------------------------------------------
// In-browser mock backend — enough behavior to drive the UI during `vite dev`
// without Tauri attached. NOT used in production builds (isTauri() is true
// whenever the app actually runs inside the Tauri webview).
// ---------------------------------------------------------------------------

let mockCat: CatState = {
  id: 1,
  name: "Comnyang",
  personality: "smart",
  personality_locked_until: null,
  level: 1,
  xp_total: 0,
  growth_stage: "kitten",
  tier: "free",
  created_at: Date.now() / 1000,
  updated_at: Date.now() / 1000,
};
let mockPomodoroSeq = 1;
const mockPomodoros: PomodoroSession[] = [];
let mockReminderSeq = 1;
const mockReminders: Reminder[] = [];
let mockMemorySeq = 1;
const mockMemories: AiMemoryEntry[] = [];
const mockSettings: Record<string, unknown> = {
  distraction_patterns: ["youtube.com", "tiktok.com", "instagram.com", "facebook.com"],
};

function cumulativeXpForLevel(level: number): number {
  if (level <= 0) return 0;
  if (level <= 10) return 100 * level;
  if (level <= 50) return 1000 + (level - 10) * 225;
  return 10000 + (level - 50) * 450;
}
function levelForXp(xp: number): number {
  let level = 1;
  while (cumulativeXpForLevel(level + 1) <= xp) level++;
  return level;
}
function growthStageForLevel(level: number): CatState["growth_stage"] {
  if (level < 10) return "kitten";
  if (level < 25) return "teen";
  if (level < 50) return "adult";
  return "legendary";
}
const XP_DEFAULTS: Record<XpSource, number> = {
  pomodoro: 20,
  reminder: 5,
  focus_session: 10,
  achievement: 50,
  rare_event: 100,
};

const mock = {
  async catGetState() {
    return mockCat;
  },
  async catSetPersonality(personality: Personality) {
    mockCat = { ...mockCat, personality, updated_at: Date.now() / 1000 };
    return mockCat;
  },
  async catRename(name: string) {
    mockCat = { ...mockCat, name, updated_at: Date.now() / 1000 };
    return mockCat;
  },
  async xpAward(source: XpSource, amount?: number): Promise<XpAwardResponse> {
    const before = mockCat.level;
    const add = amount ?? XP_DEFAULTS[source];
    const xp_total = mockCat.xp_total + add;
    const level = levelForXp(xp_total);
    mockCat = { ...mockCat, xp_total, level, growth_stage: growthStageForLevel(level), updated_at: Date.now() / 1000 };
    return { cat_state: mockCat, leveled_up: level > before };
  },

  async pomodoroStart(phase: PomodoroPhase, plannedSeconds: number): Promise<PomodoroSession> {
    const session: PomodoroSession = {
      id: mockPomodoroSeq++,
      phase,
      planned_seconds: plannedSeconds,
      actual_seconds: 0,
      status: "running",
      xp_awarded: 0,
      started_at: Date.now() / 1000,
      ended_at: null,
    };
    mockPomodoros.unshift(session);
    return session;
  },
  async pomodoroPause(sessionId: number) {
    return setMockPomodoroStatus(sessionId, "paused");
  },
  async pomodoroResume(sessionId: number) {
    return setMockPomodoroStatus(sessionId, "running");
  },
  async pomodoroComplete(sessionId: number, actualSeconds: number) {
    const s = mockPomodoros.find((p) => p.id === sessionId);
    if (!s) throw new Error("session not found");
    if (s.status === "completed") return { session: s, xp_awarded: 0 };
    s.status = "completed";
    s.actual_seconds = actualSeconds;
    s.ended_at = Date.now() / 1000;
    const xp = s.phase === "focus" ? XP_DEFAULTS.pomodoro : 0;
    s.xp_awarded = xp;
    if (xp > 0) await mock.xpAward("pomodoro", xp);
    return { session: s, xp_awarded: xp };
  },
  async pomodoroHistory() {
    return mockPomodoros;
  },

  async reminderCreate(
    title: string,
    bodyTemplate: string,
    repeatRule: RepeatRulePayload,
    firstFireAt: number,
  ): Promise<Reminder> {
    const r: Reminder = {
      id: mockReminderSeq++,
      title,
      body_template: bodyTemplate,
      repeat_rule: repeatRule.type,
      repeat_payload: repeatRule.type === "custom" ? JSON.stringify({ days: repeatRule.days_of_week }) : null,
      next_fire_at: firstFireAt,
      is_active: 1,
      created_at: Date.now() / 1000,
      updated_at: Date.now() / 1000,
    };
    mockReminders.push(r);
    return r;
  },
  async reminderList() {
    return [...mockReminders].sort((a, b) => a.next_fire_at - b.next_fire_at);
  },
  async reminderUpdate(id: number, patch: { title?: string; bodyTemplate?: string; isActive?: boolean }) {
    const r = mockReminders.find((x) => x.id === id);
    if (!r) throw new Error("reminder not found");
    if (patch.title !== undefined) r.title = patch.title;
    if (patch.bodyTemplate !== undefined) r.body_template = patch.bodyTemplate;
    if (patch.isActive !== undefined) r.is_active = patch.isActive ? 1 : 0;
    r.updated_at = Date.now() / 1000;
    return r;
  },
  async reminderDelete(id: number) {
    const idx = mockReminders.findIndex((x) => x.id === id);
    if (idx >= 0) mockReminders.splice(idx, 1);
  },

  async memorySave(kind: AiMemoryKind, content: string, sourceProvider?: AiSourceProvider, _tags?: string[]) {
    const entry: AiMemoryEntry = {
      id: mockMemorySeq++,
      kind,
      content,
      source_provider: sourceProvider ?? null,
      pinned: 0,
      created_at: Date.now() / 1000,
    };
    mockMemories.unshift(entry);
    return entry;
  },
  async memorySearch(query: string, _tag?: string) {
    if (!query.trim()) return mockMemories;
    const q = query.toLowerCase();
    return mockMemories.filter((m) => m.content.toLowerCase().includes(q));
  },
  async memoryDelete(id: number) {
    const idx = mockMemories.findIndex((m) => m.id === id);
    if (idx >= 0) mockMemories.splice(idx, 1);
  },
  async memoryListTags() {
    return [];
  },

  async achievementList(): Promise<AchievementWithProgress[]> {
    const catalog: Achievement[] = [
      { id: "first_focus", title: "First Focus", description: "Complete your first focus session.", xp_reward: 50, rule_type: "focus_sessions_completed", rule_target: 1 },
      { id: "pomodoro_master", title: "Pomodoro Master", description: "Complete 50 Pomodoro sessions.", xp_reward: 50, rule_type: "pomodoro_completed", rule_target: 50 },
      { id: "ai_explorer", title: "AI Explorer", description: "Save 10 entries to the AI Memory Vault.", xp_reward: 50, rule_type: "memory_entries_saved", rule_target: 10 },
      { id: "weekend_warrior", title: "Weekend Warrior", description: "Complete a focus session on Sat and Sun.", xp_reward: 50, rule_type: "weekend_sessions", rule_target: 2 },
      { id: "night_owl", title: "Night Owl", description: "Complete a focus session after 11 PM.", xp_reward: 50, rule_type: "late_night_sessions", rule_target: 1 },
    ];
    const completedFocus = mockPomodoros.filter((p) => p.phase === "focus" && p.status === "completed").length;
    return catalog.map((a) => {
      let progress = 0;
      if (a.rule_type === "focus_sessions_completed") progress = completedFocus;
      if (a.rule_type === "pomodoro_completed") progress = mockPomodoros.filter((p) => p.status === "completed").length;
      if (a.rule_type === "memory_entries_saved") progress = mockMemories.length;
      progress = Math.min(progress, a.rule_target);
      return { achievement: a, progress, unlocked: progress >= a.rule_target, unlocked_at: progress >= a.rule_target ? Date.now() / 1000 : null };
    });
  },

  async storyGetToday(): Promise<DailyStory> {
    return {
      id: 1,
      story_date: new Date().toISOString().slice(0, 10),
      content: "I dreamed I was chasing a 0-point laser dot through an endless server room. (Mock story — connect the Rust backend for real activity-based stories.)",
      story_type: "dream",
      generated_by: "template",
      created_at: Date.now() / 1000,
    };
  },

  async rareEventRecent(): Promise<RareEventLogRow[]> {
    return [];
  },
  async rareEventCaptureScreenshot(_logId: number, _base64Png: string): Promise<string> {
    return "(mock) screenshot not saved outside Tauri — connect the Rust backend to test this.";
  },

  async settingsGet() {
    return mockSettings;
  },
  async settingsUpdate(key: string, value: unknown) {
    mockSettings[key] = value;
  },
};

function setMockPomodoroStatus(sessionId: number, status: PomodoroSession["status"]): PomodoroSession {
  const s = mockPomodoros.find((p) => p.id === sessionId);
  if (!s) throw new Error("session not found");
  s.status = status;
  return s;
}
