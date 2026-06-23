//! F05 — Personality Engine.
//!
//! Personality is a static trait persisted on `cat_state.personality`
//! (set at onboarding, changeable via Pro tier with a cooldown — see
//! `personality_locked_until` in schema.sql). It biases *which* dialogue
//! line is shown for a given mood/context by weighting a line pool rather
//! than swapping logic, so adding personalities later only means adding
//! pool entries, not branching code (spec FR-05 AC: "provably biased…
//! testable via seeded RNG").

use rand::rngs::StdRng;
use rand::{Rng, SeedableRng};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Personality {
    Lazy,
    Hyper,
    Smart,
    Clingy,
    Tsundere,
}

impl Personality {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "lazy" => Some(Self::Lazy),
            "hyper" => Some(Self::Hyper),
            "smart" => Some(Self::Smart),
            "clingy" => Some(Self::Clingy),
            "tsundere" => Some(Self::Tsundere),
            _ => None,
        }
    }
    pub fn as_str(&self) -> &'static str {
        match self {
            Personality::Lazy => "lazy",
            Personality::Hyper => "hyper",
            Personality::Smart => "smart",
            Personality::Clingy => "clingy",
            Personality::Tsundere => "tsundere",
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DialogueContext {
    Idle,
    PomodoroComplete,
    ReminderFired,
    LevelUp,
    FocusGuardianNudge,
    Greeting,
}

struct Line {
    text: &'static str,
    /// Personalities this line is weighted toward; absent personalities
    /// still get a small base weight so every personality has *some*
    /// chance of any line (keeps dialogue from feeling broken if a pool
    /// is sparse), but matching personalities are weighted much higher.
    weight_for: &'static [Personality],
}

const BASE_WEIGHT: u32 = 1;
const MATCH_WEIGHT: u32 = 8;

fn pool(ctx: DialogueContext) -> &'static [Line] {
    use DialogueContext::*;
    use Personality::*;
    match ctx {
        Greeting => &[
            Line {
                text: "Mrow... oh, you're here. I guess that's fine.",
                weight_for: &[Tsundere],
            },
            Line {
                text: "YOU'RE BACK YOU'RE BACK let's GO let's GOOO!",
                weight_for: &[Hyper],
            },
            Line {
                text: "Welcome back. I logged 3 things while you were away.",
                weight_for: &[Smart],
            },
            Line {
                text: "*immediately sits on your hands* missed you.",
                weight_for: &[Clingy],
            },
            Line {
                text: "...five more minutes.",
                weight_for: &[Lazy],
            },
        ],
        PomodoroComplete => &[
            Line {
                text: "Good. You didn't completely waste that time.",
                weight_for: &[Tsundere],
            },
            Line {
                text: "POMODORO DESTROYED! XP incoming!!",
                weight_for: &[Hyper],
            },
            Line {
                text: "Session logged. Your focus streak is improving.",
                weight_for: &[Smart],
            },
            Line {
                text: "You did it! Can I sit with you now? Please?",
                weight_for: &[Clingy],
            },
            Line {
                text: "huh, we're done already? okay nap time then.",
                weight_for: &[Lazy],
            },
        ],
        ReminderFired => &[
            Line {
                text: "Hey. Drink water. Not because I care or anything.",
                weight_for: &[Tsundere],
            },
            Line {
                text: "HYDRATION CHECK! GO GO GO!",
                weight_for: &[Hyper],
            },
            Line {
                text: "Reminder: this is the optimal time for that task.",
                weight_for: &[Smart],
            },
            Line {
                text: "Pssst. Reminder. Also please don't leave.",
                weight_for: &[Clingy],
            },
            Line {
                text: "...there's a reminder. you deal with it.",
                weight_for: &[Lazy],
            },
        ],
        LevelUp => &[
            Line {
                text: "Tch. Fine, you leveled up. Happy now?",
                weight_for: &[Tsundere],
            },
            Line {
                text: "LEVEL UP LEVEL UP LEVEL UUUP!!!",
                weight_for: &[Hyper],
            },
            Line {
                text: "Growth milestone reached. Statistically impressive.",
                weight_for: &[Smart],
            },
            Line {
                text: "We leveled up TOGETHER. I'm so proud!",
                weight_for: &[Clingy],
            },
            Line {
                text: "mm, level up. cool. anyway, nap.",
                weight_for: &[Lazy],
            },
        ],
        FocusGuardianNudge => &[
            Line {
                text: "...are you seriously watching that right now?",
                weight_for: &[Tsundere],
            },
            Line {
                text: "DISTRACTION DETECTED ABORT ABORT— I mean, focus!",
                weight_for: &[Hyper],
            },
            Line {
                text: "Noted: a context switch just occurred. Costly.",
                weight_for: &[Smart],
            },
            Line {
                text: "Hey hey hey come back I miss your focus face.",
                weight_for: &[Clingy],
            },
            Line {
                text: "eh, whatever you're doing is fine I guess.",
                weight_for: &[Lazy],
            },
        ],
        Idle => &[
            Line {
                text: "Don't look at me like that. I'm just resting.",
                weight_for: &[Tsundere],
            },
            Line {
                text: "bored bored bored let's DO something!!",
                weight_for: &[Hyper],
            },
            Line {
                text: "Calculating optimal nap angle.",
                weight_for: &[Smart],
            },
            Line {
                text: "*stares at you until you notice*",
                weight_for: &[Clingy],
            },
            Line {
                text: "zzz...",
                weight_for: &[Lazy],
            },
        ],
    }
}

/// Deterministic, seedable line pick — used directly by tests, and by the
/// `seed` param accepted from the frontend in debug builds for QA replay.
pub fn pick_line(personality: Personality, ctx: DialogueContext, seed: u64) -> &'static str {
    let lines = pool(ctx);
    let weights: Vec<u32> = lines
        .iter()
        .map(|l| {
            if l.weight_for.contains(&personality) {
                MATCH_WEIGHT
            } else {
                BASE_WEIGHT
            }
        })
        .collect();
    let total: u32 = weights.iter().sum();
    let mut rng = StdRng::seed_from_u64(seed);
    let mut roll = rng.gen_range(0..total);
    for (line, w) in lines.iter().zip(weights.iter()) {
        if roll < *w {
            return line.text;
        }
        roll -= w;
    }
    lines[0].text
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matching_personality_is_picked_far_more_often() {
        let mut matches = 0;
        let trials = 2000;
        for seed in 0..trials {
            let line = pick_line(Personality::Hyper, DialogueContext::PomodoroComplete, seed);
            if line.contains("DESTROYED") {
                matches += 1;
            }
        }
        // weight 8 of total (8 + 4*1 = 12) => ~66% expected
        let ratio = matches as f64 / trials as f64;
        assert!(ratio > 0.55 && ratio < 0.80, "ratio was {ratio}");
    }

    #[test]
    fn personality_round_trips_through_str() {
        for p in [
            Personality::Lazy,
            Personality::Hyper,
            Personality::Smart,
            Personality::Clingy,
            Personality::Tsundere,
        ] {
            assert_eq!(Personality::from_str(p.as_str()), Some(p));
        }
    }
}
