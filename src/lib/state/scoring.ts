// The scoring engine. One pure function used in two places:
//   - client side, on every fold, for the provisional "on the pitch" points
//     (rollback falls out naturally: a VAR-discarded goal disappears from
//     the fold, the breakdown recomputes, the points move back down)
//   - server side, at resolution, against the FINAL event-sourced state at
//     the whistle. Resolution is the only score that persists.

import { SCORING } from "@/lib/config/scoring";
import type { MatchState } from "@/lib/state/fold";

export interface BreakdownItem {
  type:
    | "goal_for"
    | "goal_conceded"
    | "clean_sheet"
    | "win_at_whistle"
    | "draw_salvaged"
    | "goal_overturned";
  label: string;
  minute: number | null;
  points: number;
}

export interface EntryContext {
  team: 1 | 2;
  // Feed timestamp of the entry instant. The scoring window is every event
  // strictly after this timestamp.
  entryFeedTs: number;
  // Score at the entry instant (from folding the log up to entryFeedTs).
  scoreTeamAtEntry: number;
  scoreOppAtEntry: number;
}

export interface WindowScore {
  windowPoints: number;
  breakdown: BreakdownItem[];
  finalScoreTeam: number;
  finalScoreOpp: number;
}

// Multiplier from win probability p at entry. Locked shape:
// 1.0x at p >= 0.75, 10.0x at p <= 0.05, linear in between.
export function multiplierForProb(p: number): number {
  const { MULTIPLIER_LOW, MULTIPLIER_HIGH, PROB_CEILING, PROB_FLOOR } = SCORING;
  if (p >= PROB_CEILING) return MULTIPLIER_LOW;
  if (p <= PROB_FLOOR) return MULTIPLIER_HIGH;
  const t = (PROB_CEILING - p) / (PROB_CEILING - PROB_FLOOR);
  return MULTIPLIER_LOW + t * (MULTIPLIER_HIGH - MULTIPLIER_LOW);
}

function minuteLabel(minute: number | null): string {
  return minute === null ? "" : ` ${minute}'`;
}

// Score the window against a match state. Pass the state at the whistle for
// resolution, or the current state for a provisional read; `settled` says
// which, and gates the whistle bonuses' labels only (the math is identical
// so the provisional number is always "final points if it ended right
// now").
export function scoreWindow(
  entry: EntryContext,
  state: MatchState,
  opts: { settled: boolean } = { settled: true }
): WindowScore {
  const { team } = entry;
  const opp = team === 1 ? 2 : 1;
  const breakdown: BreakdownItem[] = [];

  // Window goals: strictly after the entry instant, net of VAR discards.
  // Discarded goals inside the window are shown as zero-point overturned
  // lines so the story is visible in the breakdown.
  const windowGoals = state.countables.filter(
    (c) => c.kind === "goal" && c.ts > entry.entryFeedTs
  );
  let conceded = 0;
  for (const g of windowGoals) {
    const minute = Math.floor(g.clockSeconds / 60) + 1;
    if (g.discarded) {
      breakdown.push({
        type: "goal_overturned",
        label: `VAR: goal overturned${minuteLabel(minute)}`,
        minute,
        points: 0,
      });
      continue;
    }
    if (g.participant === team) {
      breakdown.push({
        type: "goal_for",
        label: `Goal for your side${minuteLabel(minute)}`,
        minute,
        points: SCORING.GOAL_FOR,
      });
    } else {
      conceded += 1;
      breakdown.push({
        type: "goal_conceded",
        label: `Goal conceded${minuteLabel(minute)}`,
        minute,
        points: SCORING.GOAL_CONCEDED,
      });
    }
  }

  if (conceded === 0) {
    breakdown.push({
      type: "clean_sheet",
      label: opts.settled
        ? "Nothing conceded on your watch"
        : "Nothing conceded on your watch (so far)",
      minute: null,
      points: SCORING.CLEAN_SHEET_WINDOW,
    });
  }

  const finalScoreTeam = team === 1 ? state.score.p1 : state.score.p2;
  const finalScoreOpp = opp === 1 ? state.score.p1 : state.score.p2;

  if (finalScoreTeam > finalScoreOpp) {
    breakdown.push({
      type: "win_at_whistle",
      label: opts.settled ? "Win at the whistle" : "Winning as it stands",
      minute: null,
      points: SCORING.WIN_AT_WHISTLE,
    });
  } else if (
    finalScoreTeam === finalScoreOpp &&
    entry.scoreTeamAtEntry < entry.scoreOppAtEntry
  ) {
    breakdown.push({
      type: "draw_salvaged",
      label: opts.settled ? "Draw salvaged from behind" : "Draw salvaged as it stands",
      minute: null,
      points: SCORING.DRAW_SALVAGED_FROM_BEHIND,
    });
  }

  const windowPoints = breakdown.reduce((sum, item) => sum + item.points, 0);
  return { windowPoints, breakdown, finalScoreTeam, finalScoreOpp };
}

// Final = max(0, window points) x multiplier. The multiplier was locked at
// the entry instant.
export function finalPoints(windowPoints: number, multiplier: number): number {
  return Math.round(Math.max(0, windowPoints) * multiplier * 10) / 10;
}
