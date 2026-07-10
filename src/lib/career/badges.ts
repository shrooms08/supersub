// The badge cabinet. Exactly six badges in v1, computed from resolved
// entries at resolution time and persisted; this module is pure so the
// boundary cases are unit-testable (see scripts/test-badges.ts).

import { windowGoals, windowResult } from "./window";
import type { BreakdownItem } from "@/lib/state/scoring";

export type BadgeKey =
  | "first_whistle"
  | "miracle_worker"
  | "iron_nerve"
  | "comeback_king"
  | "ever_present"
  | "wounded";

export interface BadgeDef {
  key: BadgeKey;
  name: string;
  // Broadcast voice, shown in the cabinet.
  description: string;
}

export const BADGES: readonly BadgeDef[] = [
  {
    key: "first_whistle",
    name: "First Whistle",
    description: "Your first appearance. Everyone remembers their debut.",
  },
  {
    key: "miracle_worker",
    name: "Miracle Worker",
    description: "Won your window after coming on with 10 in 100 or worse.",
  },
  {
    key: "iron_nerve",
    name: "Iron Nerve",
    description: "Entered in the 85th minute or later. Stoppage time is a home.",
  },
  {
    key: "comeback_king",
    name: "Comeback King",
    description: "Came on behind, left with something. Salvage business.",
  },
  {
    key: "ever_present",
    name: "Ever Present",
    description: "Five appearances. The gaffer keeps looking down the bench.",
  },
  {
    key: "wounded",
    name: "Wounded",
    description: "Conceded three or more on your watch. It happens to everyone.",
  },
] as const;

// The facts a badge evaluation needs from one resolved entry. Matches the
// entries table columns; constructed directly in unit tests.
export interface ResolvedEntryFacts {
  entry_minute: number;
  win_prob_at_entry: number;
  score_team_at_entry: number;
  score_opp_at_entry: number;
  final_score_team: number;
  final_score_opp: number;
  breakdown: BreakdownItem[];
}

// Badges earned BY this resolution. `appearances` counts resolved entries
// for the player INCLUDING this one. Already-earned badges are deduped by
// the primary key on player_badges, so re-reporting one is harmless.
export function evaluateBadges(entry: ResolvedEntryFacts, appearances: number): BadgeKey[] {
  const earned: BadgeKey[] = [];

  if (appearances === 1) earned.push("first_whistle");
  if (appearances >= 5) earned.push("ever_present");

  // Miracle Worker: won the window after entering at p <= 0.10.
  if (entry.win_prob_at_entry <= 0.10 && windowResult(entry.breakdown) === "W") {
    earned.push("miracle_worker");
  }

  // Iron Nerve: entered in the 85th minute or later.
  if (entry.entry_minute >= 85) earned.push("iron_nerve");

  // Comeback King: behind at entry, draw or better at the whistle.
  if (
    entry.score_team_at_entry < entry.score_opp_at_entry &&
    entry.final_score_team >= entry.final_score_opp
  ) {
    earned.push("comeback_king");
  }

  // Wounded: conceded 3+ in one window.
  if (windowGoals(entry.breakdown).goalsAgainst >= 3) earned.push("wounded");

  return earned;
}
