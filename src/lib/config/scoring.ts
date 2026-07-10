// Scoring constants (locked structure). Every number the scoring engine
// uses lives here and nowhere else.

export const SCORING = {
  // Window events, for the user's team, from entry until the whistle.
  GOAL_FOR: 100,
  GOAL_CONCEDED: -50,
  CLEAN_SHEET_WINDOW: 40,
  // Whistle bonuses.
  WIN_AT_WHISTLE: 100,
  DRAW_SALVAGED_FROM_BEHIND: 60,
  // Multiplier from win probability p at the entry instant:
  // 1.0x when p >= 0.75, 10.0x when p <= 0.05, linear in between.
  MULTIPLIER_LOW: 1.0,
  MULTIPLIER_HIGH: 10.0,
  PROB_CEILING: 0.75,
  PROB_FLOOR: 0.05,
  // A career entry counts as legendary when its final score reaches this.
  LEGENDARY_POINTS: 500,
} as const;

// Display treatment only (Phase 2): the locked multiplier gets a named
// tier. The scoring math above is untouched.
export interface MultiplierTier {
  name: string;
  // Inclusive lower bound; a tier runs to the next tier's min.
  min: number;
}

export const MULTIPLIER_TIERS: readonly MultiplierTier[] = [
  { name: "Safe Hands", min: 1.0 },
  { name: "Squad Rotation", min: 2.0 },
  { name: "The Gamble", min: 4.0 },
  { name: "Miracle Territory", min: 7.0 },
] as const;

export function tierForMultiplier(multiplier: number): MultiplierTier {
  let tier = MULTIPLIER_TIERS[0];
  for (const t of MULTIPLIER_TIERS) {
    if (multiplier >= t.min) tier = t;
  }
  return tier;
}
