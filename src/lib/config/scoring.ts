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
} as const;
