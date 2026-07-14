// Badge logic unit tests against constructed resolved entries.
// Run with: npm run test:badges
//
// Required boundaries per the Phase 2 definition of done:
//   - Miracle Worker boundary at p = 0.10 (inclusive)
//   - Iron Nerve boundary at minute 85 (inclusive)
//   - Comeback King from-behind detection
// plus the rest of the cabinet and the window result derivation.

import { evaluateBadges, type ResolvedEntryFacts } from "../src/lib/career/badges";
import { windowResult } from "../src/lib/career/window";
import { tierForMultiplier } from "../src/lib/config/scoring";
import type { BreakdownItem } from "../src/lib/state/scoring";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

const goalFor = (minute: number): BreakdownItem => ({
  type: "goal_for",
  label: `Goal for your side ${minute}'`,
  minute,
  points: 10,
});
const goalConceded = (minute: number): BreakdownItem => ({
  type: "goal_conceded",
  label: `Goal conceded ${minute}'`,
  minute,
  points: -5,
});
const overturned = (minute: number): BreakdownItem => ({
  type: "goal_overturned",
  label: `VAR: goal overturned ${minute}'`,
  minute,
  points: 0,
});

// A neutral resolved entry to build variations from.
function entry(overrides: Partial<ResolvedEntryFacts>): ResolvedEntryFacts {
  return {
    entry_minute: 60,
    win_prob_at_entry: 0.5,
    score_team_at_entry: 0,
    score_opp_at_entry: 0,
    final_score_team: 0,
    final_score_opp: 0,
    breakdown: [],
    ...overrides,
  };
}

// First Whistle and Ever Present
check(
  "first appearance earns First Whistle",
  evaluateBadges(entry({}), 1).includes("first_whistle")
);
check(
  "second appearance does not re-earn First Whistle",
  !evaluateBadges(entry({}), 2).includes("first_whistle")
);
check(
  "fourth appearance is not Ever Present",
  !evaluateBadges(entry({}), 4).includes("ever_present")
);
check(
  "fifth appearance earns Ever Present",
  evaluateBadges(entry({}), 5).includes("ever_present")
);

// Miracle Worker boundary at p = 0.10, window must be WON
const wonWindow = { breakdown: [goalFor(70)] };
check(
  "Miracle Worker at exactly p = 0.10 with won window",
  evaluateBadges(entry({ win_prob_at_entry: 0.1, ...wonWindow }), 2).includes("miracle_worker")
);
check(
  "no Miracle Worker just above the boundary (p = 0.101)",
  !evaluateBadges(entry({ win_prob_at_entry: 0.101, ...wonWindow }), 2).includes("miracle_worker")
);
check(
  "no Miracle Worker at p = 0.10 with drawn window",
  !evaluateBadges(entry({ win_prob_at_entry: 0.1, breakdown: [] }), 2).includes("miracle_worker")
);
check(
  "no Miracle Worker at p = 0.10 when the window was lost",
  !evaluateBadges(entry({ win_prob_at_entry: 0.1, breakdown: [goalConceded(80)] }), 2).includes(
    "miracle_worker"
  )
);
check(
  "overturned goals do not win a window",
  !evaluateBadges(entry({ win_prob_at_entry: 0.05, breakdown: [overturned(49)] }), 2).includes(
    "miracle_worker"
  )
);

// Iron Nerve boundary at minute 85
check(
  "no Iron Nerve at minute 84",
  !evaluateBadges(entry({ entry_minute: 84 }), 2).includes("iron_nerve")
);
check(
  "Iron Nerve at exactly minute 85",
  evaluateBadges(entry({ entry_minute: 85 }), 2).includes("iron_nerve")
);
check(
  "Iron Nerve in stoppage time (minute 93)",
  evaluateBadges(entry({ entry_minute: 93 }), 2).includes("iron_nerve")
);

// Comeback King: behind at entry, draw or better at the whistle
check(
  "Comeback King: 0-1 at entry, 1-1 at the whistle",
  evaluateBadges(
    entry({ score_team_at_entry: 0, score_opp_at_entry: 1, final_score_team: 1, final_score_opp: 1 }),
    2
  ).includes("comeback_king")
);
check(
  "Comeback King: 0-1 at entry, won 2-1",
  evaluateBadges(
    entry({ score_team_at_entry: 0, score_opp_at_entry: 1, final_score_team: 2, final_score_opp: 1 }),
    2
  ).includes("comeback_king")
);
check(
  "no Comeback King when level at entry (0-0 to 1-0)",
  !evaluateBadges(
    entry({ score_team_at_entry: 0, score_opp_at_entry: 0, final_score_team: 1, final_score_opp: 0 }),
    2
  ).includes("comeback_king")
);
check(
  "no Comeback King when still behind at the whistle (0-1 to 1-2)",
  !evaluateBadges(
    entry({ score_team_at_entry: 0, score_opp_at_entry: 1, final_score_team: 1, final_score_opp: 2 }),
    2
  ).includes("comeback_king")
);

// Wounded: conceded 3+ in one window
check(
  "no Wounded at two conceded",
  !evaluateBadges(entry({ breakdown: [goalConceded(50), goalConceded(60)] }), 2).includes("wounded")
);
check(
  "Wounded at exactly three conceded",
  evaluateBadges(
    entry({ breakdown: [goalConceded(50), goalConceded(60), goalConceded(70)] }),
    2
  ).includes("wounded")
);

// Window result derivation
check("window W from breakdown", windowResult([goalFor(50)]) === "W");
check("window D from empty breakdown", windowResult([]) === "D");
check("window L from breakdown", windowResult([goalConceded(50)]) === "L");
check(
  "window D when goals cancel out",
  windowResult([goalFor(50), goalConceded(60)]) === "D"
);

// Multiplier tier boundaries (display treatment, Phase 2)
check("1.0x is Safe Hands", tierForMultiplier(1.0).name === "Safe Hands");
check("1.99x is Safe Hands", tierForMultiplier(1.99).name === "Safe Hands");
check("2.0x is Squad Rotation", tierForMultiplier(2.0).name === "Squad Rotation");
check("3.99x is Squad Rotation", tierForMultiplier(3.99).name === "Squad Rotation");
check("4.0x is The Gamble", tierForMultiplier(4.0).name === "The Gamble");
check("6.99x is The Gamble", tierForMultiplier(6.99).name === "The Gamble");
check("7.0x is Miracle Territory", tierForMultiplier(7.0).name === "Miracle Territory");
check("10.0x is Miracle Territory", tierForMultiplier(10.0).name === "Miracle Territory");

// Exhibition rule: First Whistle on any debut, every other badge live-only.
const exhibitionMiracle = {
  win_prob_at_entry: 0.05,
  breakdown: [goalFor(80)], // a won window that would be Miracle Worker if live
};
check(
  "exhibition debut still earns First Whistle",
  evaluateBadges(entry(exhibitionMiracle), 1, { exhibition: true, liveAppearances: 0 }).includes(
    "first_whistle"
  )
);
check(
  "exhibition entry earns NOTHING but First Whistle (no Miracle Worker)",
  !evaluateBadges(entry(exhibitionMiracle), 1, { exhibition: true, liveAppearances: 0 }).includes(
    "miracle_worker"
  )
);
check(
  "exhibition entry does not earn Iron Nerve at 90'",
  !evaluateBadges(entry({ entry_minute: 90 }), 2, { exhibition: true, liveAppearances: 0 }).includes(
    "iron_nerve"
  )
);
check(
  "Ever Present needs 5 LIVE appearances (exhibitions do not count)",
  !evaluateBadges(entry({}), 6, { exhibition: false, liveAppearances: 4 }).includes("ever_present")
);
check(
  "Ever Present earned on the 5th LIVE appearance even with exhibitions in the total",
  evaluateBadges(entry({}), 8, { exhibition: false, liveAppearances: 5 }).includes("ever_present")
);
check(
  "a live entry still earns its badges normally under the new signature",
  evaluateBadges(entry({ entry_minute: 88 }), 1, { exhibition: false, liveAppearances: 1 }).includes(
    "iron_nerve"
  )
);

console.log(failures === 0 ? "\nAll badge checks passed." : `\n${failures} CHECKS FAILED`);
process.exit(failures === 0 ? 0 : 1);
