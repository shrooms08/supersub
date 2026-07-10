// Career aggregates over a player's resolved entries. Pure functions over
// entry rows; the career API folds these server-side and the career page
// renders them.

import { SCORING } from "@/lib/config/scoring";
import { windowResult, type WindowResult } from "./window";
import type { EntryRow } from "@/lib/entry";

export interface CareerRecord {
  appearances: number;
  totalPoints: number;
  averageMultiplier: number | null;
  legendaryCount: number;
  // Last 5 windows, most recent first.
  form: WindowResult[];
  // Rolling average of final scores over all appearances: the hero number.
  impactRating: number | null;
}

export function careerRecord(resolvedEntries: EntryRow[]): CareerRecord {
  const resolved = resolvedEntries
    .filter((e) => e.resolved_at !== null)
    .sort((a, b) => (a.resolved_at! < b.resolved_at! ? 1 : -1));

  const appearances = resolved.length;
  const totalPoints = resolved.reduce((sum, e) => sum + (e.final_points ?? 0), 0);
  const averageMultiplier =
    appearances > 0
      ? resolved.reduce((sum, e) => sum + e.multiplier, 0) / appearances
      : null;
  const legendaryCount = resolved.filter(
    (e) => (e.final_points ?? 0) >= SCORING.LEGENDARY_POINTS
  ).length;
  const form = resolved.slice(0, 5).map((e) => windowResult(e.breakdown));
  const impactRating = appearances > 0 ? totalPoints / appearances : null;

  return { appearances, totalPoints, averageMultiplier, legendaryCount, form, impactRating };
}
