// Mirrors src-tauri/src/db/models.rs — keep in sync manually for MVP.
// (Post-MVP: consider ts-rs or specta to generate this file from Rust.)

export type Personality = "lazy" | "hyper" | "smart" | "clingy" | "tsundere";
export type GrowthStage = "kitten" | "teen" | "adult" | "legendary";
export type Tier = "free" | "pro";
export type Mood = "happy" | "focused" | "sleepy" | "curious" | "hungry" | "lonely";

export interface CatState {
  id: number;
  name: string;
  personality: Personality;
  personality_locked_until: number | null;
  level: number;
  xp_total: number;
  growth_stage: GrowthStage;
  tier: Tier;
  created_at: number;
  updated_at: number;
}

export type PomodoroPhase = "focus" | "break";
export type PomodoroStatus = "running" | "paused" | "completed" | "abandoned";

export interface PomodoroSession {
  id: number;
  phase: PomodoroPhase;
  planned_seconds: number;
  actual_seconds: number;
  status: PomodoroStatus;
  xp_awarded: number;
  started_at: number;
  ended_at: number | null;
}

export type RepeatRuleType = "none" | "daily" | "weekly" | "custom";

export interface Reminder {
  id: number;
  title: string;
  body_template: string;
  repeat_rule: RepeatRuleType;
  repeat_payload: string | null;
  next_fire_at: number;
  is_active: 0 | 1;
  created_at: number;
  updated_at: number;
}

export type RepeatRulePayload =
  | { type: "none" }
  | { type: "daily" }
  | { type: "weekly" }
  | { type: "custom"; days_of_week: number[] };

export type AiMemoryKind = "prompt" | "response" | "snippet";
export type AiSourceProvider = "openai" | "claude" | "gemini" | "ollama" | "manual";

export interface AiMemoryEntry {
  id: number;
  kind: AiMemoryKind;
  content: string;
  source_provider: AiSourceProvider | null;
  pinned: 0 | 1;
  created_at: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  xp_reward: number;
  rule_type: string;
  rule_target: number;
}

export interface AchievementWithProgress {
  achievement: Achievement;
  progress: number;
  unlocked: boolean;
  unlocked_at: number | null;
}

export type StoryType = "dream" | "adventure" | "funny";

export interface DailyStory {
  id: number;
  story_date: string;
  content: string;
  story_type: StoryType;
  generated_by: "template" | "openai" | "claude" | "gemini" | "ollama";
  created_at: number;
}

export type RareEventType = "golden_cat" | "ghost_cat" | "ninja_cat";

export interface RareEventLogRow {
  id: number;
  event_type: RareEventType;
  triggered_at: number;
  screenshot_path: string | null;
  shared: 0 | 1;
}

export type XpSource = "pomodoro" | "reminder" | "focus_session" | "achievement" | "rare_event";

export interface XpAwardResponse {
  cat_state: CatState;
  leveled_up: boolean;
}
