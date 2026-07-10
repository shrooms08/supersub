// Window outcome for a resolved entry, derived from its stored breakdown.
// The window is won if the player's side outscored the opponent after
// entry, drawn if level, lost if outscored. VAR-overturned goals carry
// zero points and a distinct type, so they never count here.

import type { BreakdownItem } from "@/lib/state/scoring";

export type WindowResult = "W" | "D" | "L";

export function windowGoals(breakdown: BreakdownItem[] | null | undefined): {
  goalsFor: number;
  goalsAgainst: number;
} {
  let goalsFor = 0;
  let goalsAgainst = 0;
  for (const item of breakdown ?? []) {
    if (item.type === "goal_for") goalsFor += 1;
    if (item.type === "goal_conceded") goalsAgainst += 1;
  }
  return { goalsFor, goalsAgainst };
}

export function windowResult(breakdown: BreakdownItem[] | null | undefined): WindowResult {
  const { goalsFor, goalsAgainst } = windowGoals(breakdown);
  if (goalsFor > goalsAgainst) return "W";
  if (goalsFor < goalsAgainst) return "L";
  return "D";
}
