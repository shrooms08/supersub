// Event-sourced match state (binding architecture requirements 2 and 3).
//
// State is ALWAYS a pure function of the ordered event log: foldMatch takes
// the full normalized log and returns the current state. There are no
// incremental tallies kept anywhere as a source of truth; callers re-fold
// on every new event (1116 events for a full match folds in well under a
// millisecond, so this is cheap).
//
// Two feed realities shape the fold:
//
// 1. VAR rollback (spike risk 1): a goal arrives as several events sharing
//    one action id (Confirmed false, then true, then true with PlayerId),
//    and action_discarded later points at that id to erase it. France v
//    Morocco 18209181: goal id 495 at 48:44 discarded two seconds later.
// 2. Absent key means zero (spike risk 2): handled upstream in
//    normalize.ts, which zero-fills TeamCounters whenever a participant's
//    Score entry is present.
//
// Score reconciliation: the latest Score-bearing event is the authoritative
// cumulative baseline for each team (this makes mid-match joins from the
// per-action snapshot endpoint correct, where the log starts at "latest
// event per action type" rather than kickoff). Countable events (goals,
// cards, corners) that arrive AFTER that baseline adjust it, and an
// action_discarded that erases an event already counted INSIDE the
// baseline subtracts from it. Everything is keyed by action id, so
// duplicate confirmations never double-count.

import type {
  Fixture,
  MatchEvent,
  Phase,
  TeamCounters,
} from "@/lib/feed/types";

export type CountableKind = "goal" | "corner" | "yellow_card" | "red_card";

const COUNTER_KEY: Record<CountableKind, keyof TeamCounters> = {
  goal: "goals",
  corner: "corners",
  yellow_card: "yellowCards",
  red_card: "redCards",
};

// Ticker-worthy actions and how loud they are.
const TICKER_ACTIONS = new Set([
  "goal",
  "yellow_card",
  "red_card",
  "corner",
  "penalty",
  "penalty_outcome",
  "var",
  "var_end",
  "kickoff",
  "halftime_finalised",
  "game_finalised",
  "additional_time",
  "substitution",
]);

export interface CountableItem {
  id: number;
  kind: CountableKind;
  participant: number;
  seq: number;
  ts: number;
  clockSeconds: number;
  confirmed: boolean;
  discarded: boolean;
}

export interface TickerItem {
  id: number;
  seq: number;
  ts: number;
  action: string;
  participant?: number;
  minute: number | null;
  discarded: boolean;
  detail?: string;
}

export interface MatchState {
  fixtureId: number;
  phase: Phase;
  finishedBy: "game_finalised" | "status_5" | "stale_clock" | null;
  statusId?: number;
  kickoffTs: number | null;
  // Latest clock reading plus the feed timestamp it was observed at, so the
  // UI can extrapolate the running minute between events.
  clock: { running: boolean; seconds: number; ts: number } | null;
  additionalTimeMinutes: number | null;
  score: { p1: number; p2: number };
  counters: { p1: TeamCounters; p2: TeamCounters };
  // Net-of-discards countable events, ordered by seq. Goals in here are the
  // basis for window scoring; a VAR-erased goal stays present with
  // discarded=true so the UI can show the overturn.
  countables: CountableItem[];
  ticker: TickerItem[];
  lastEventTs: number;
  startTime: number | null;
  eventCount: number;
}

const ZERO: TeamCounters = { goals: 0, corners: 0, yellowCards: 0, redCards: 0 };

function minuteFromSeconds(seconds: number, running: boolean): number {
  // Match convention: 2924s is 48:44, displayed as the 49th minute.
  return Math.floor(seconds / 60) + (seconds > 0 || running ? 1 : 0);
}

export function stateMinute(state: MatchState, feedNow?: number): number {
  if (!state.clock) return 0;
  let seconds = state.clock.seconds;
  if (state.clock.running && feedNow !== undefined && feedNow > state.clock.ts) {
    seconds += (feedNow - state.clock.ts) / 1000;
  }
  return minuteFromSeconds(Math.floor(seconds), state.clock.running);
}

interface TeamBaseline {
  totals: TeamCounters;
  seq: number; // seq of the event that carried these totals
}

// Finished heuristic (binding architecture requirement 3). GameState is
// ignored entirely: the spike observed it stuck on "scheduled" for all 1116
// events of a finished match. A match is considered finished when any of:
//   a. a game_finalised event was seen (authoritative; arrives with
//      StatusId 100 a few minutes after the whistle), or
//   b. a status event with StatusId 5 was seen (observed value at the
//      final whistle, before finalisation; StatusId flow observed live:
//      2 first half, 3 halftime, 4 second half, 5 full time whistle,
//      100 finalised), or
//   c. staleness: the clock shows 90+ minutes played AND the feed has been
//      silent for 20+ minutes of feed time. This covers a feed that dies
//      without ever finalising. It needs "now", so callers pass feedNow.
function derivePhase(
  s: {
    sawGameFinalised: boolean;
    sawStatus5: boolean;
    kickoffTs: number | null;
    lastEventTs: number;
    clockSeconds: number;
    startTime: number | null;
  },
  feedNow?: number
): { phase: Phase; finishedBy: MatchState["finishedBy"] } {
  if (s.sawGameFinalised) return { phase: "finished", finishedBy: "game_finalised" };
  if (s.sawStatus5) return { phase: "finished", finishedBy: "status_5" };
  if (
    feedNow !== undefined &&
    s.clockSeconds >= 90 * 60 &&
    s.lastEventTs > 0 &&
    feedNow - s.lastEventTs > 20 * 60_000
  ) {
    return { phase: "finished", finishedBy: "stale_clock" };
  }
  if (s.kickoffTs !== null) return { phase: "live", finishedBy: null };
  return { phase: "upcoming", finishedBy: null };
}

export function foldMatch(
  events: MatchEvent[],
  opts: { feedNow?: number } = {}
): MatchState {
  const ordered = [...events].sort((a, b) => a.seq - b.seq || a.ts - b.ts);

  const baselines: { p1: TeamBaseline; p2: TeamBaseline } = {
    p1: { totals: { ...ZERO }, seq: -1 },
    p2: { totals: { ...ZERO }, seq: -1 },
  };
  const countablesById = new Map<number, CountableItem>();
  const ticker: TickerItem[] = [];
  const tickerById = new Map<number, TickerItem>();

  let kickoffTs: number | null = null;
  let sawGameFinalised = false;
  let sawStatus5 = false;
  let statusId: number | undefined;
  let clock: MatchState["clock"] = null;
  let additionalTimeMinutes: number | null = null;
  let lastEventTs = 0;
  let startTime: number | null = null;
  let fixtureId = 0;

  for (const e of ordered) {
    fixtureId = e.fixtureId;
    lastEventTs = Math.max(lastEventTs, e.ts);
    if (e.startTime !== undefined) startTime = e.startTime;
    if (e.statusId !== undefined) statusId = e.statusId;
    if (e.clock) clock = { running: e.clock.running, seconds: e.clock.seconds, ts: e.ts };

    // Authoritative cumulative totals when a participant Score entry is
    // present (already zero-filled by the normalization layer).
    if (e.score?.p1) baselines.p1 = { totals: e.score.p1, seq: e.seq };
    if (e.score?.p2) baselines.p2 = { totals: e.score.p2, seq: e.seq };

    switch (e.action) {
      case "kickoff":
        if (kickoffTs === null) kickoffTs = e.ts;
        break;
      case "status":
        if (e.statusId === 5 || e.data?.statusId === 5) sawStatus5 = true;
        // A period change retires the previous period's added time board.
        additionalTimeMinutes = null;
        break;
      case "game_finalised":
        sawGameFinalised = true;
        break;
      case "additional_time":
        if (typeof e.data?.minutes === "number") additionalTimeMinutes = e.data.minutes;
        break;
      case "action_discarded": {
        // Erase by action id. This is the VAR rollback path: the state
        // after this event must look as if the discarded action never
        // happened, even if no fresh Score map has arrived yet.
        const target = countablesById.get(e.id);
        if (target) target.discarded = true;
        const tick = tickerById.get(e.id);
        if (tick) tick.discarded = true;
        break;
      }
      default:
        break;
    }

    if (e.action in COUNTER_KEY) {
      const kind = e.action as CountableKind;
      if (e.participant !== undefined) {
        const existing = countablesById.get(e.id);
        if (existing) {
          // Re-confirmation or amendment of the same action: update flags,
          // never count twice.
          existing.confirmed = e.confirmed ?? existing.confirmed;
          existing.clockSeconds = e.clock?.seconds ?? existing.clockSeconds;
        } else {
          countablesById.set(e.id, {
            id: e.id,
            kind,
            participant: e.participant,
            seq: e.seq,
            ts: e.ts,
            clockSeconds: e.clock?.seconds ?? 0,
            confirmed: e.confirmed ?? false,
            discarded: false,
          });
        }
      }
    }

    if (TICKER_ACTIONS.has(e.action)) {
      const existing = tickerById.get(e.id);
      if (existing) {
        if (e.data?.outcome) existing.detail = String(e.data.outcome);
        if (e.data?.minutes !== undefined) existing.detail = `+${e.data.minutes}`;
      } else {
        const item: TickerItem = {
          id: e.id,
          seq: e.seq,
          ts: e.ts,
          action: e.action,
          participant: e.participant,
          minute: e.clock ? minuteFromSeconds(e.clock.seconds, e.clock.running) : null,
          discarded: false,
          detail:
            e.data?.outcome !== undefined
              ? String(e.data.outcome)
              : e.data?.minutes !== undefined
                ? `+${e.data.minutes}`
                : undefined,
        };
        ticker.push(item);
        tickerById.set(e.id, item);
      }
    }
  }

  // Reconcile counters: baseline totals, plus countables newer than the
  // baseline, minus discarded countables the baseline had already counted.
  const counters = { p1: { ...baselines.p1.totals }, p2: { ...baselines.p2.totals } };
  for (const item of countablesById.values()) {
    const side = item.participant === 1 ? "p1" : "p2";
    const baselineSeq = baselines[side].seq;
    const key = COUNTER_KEY[item.kind];
    if (item.discarded) {
      if (item.seq <= baselineSeq) {
        // Counted inside the baseline, later erased with no fresh totals
        // yet: subtract so the fold is correct immediately.
        counters[side][key] = Math.max(0, counters[side][key] - 1);
      }
      continue;
    }
    if (item.seq > baselineSeq) counters[side][key] += 1;
  }

  const clockSeconds = clock?.seconds ?? 0;
  const { phase, finishedBy } = derivePhase(
    { sawGameFinalised, sawStatus5, kickoffTs, lastEventTs, clockSeconds, startTime },
    opts.feedNow
  );

  return {
    fixtureId,
    phase,
    finishedBy,
    statusId,
    kickoffTs,
    clock,
    additionalTimeMinutes,
    score: { p1: counters.p1.goals, p2: counters.p2.goals },
    counters,
    countables: [...countablesById.values()].sort((a, b) => a.seq - b.seq),
    ticker: ticker.sort((a, b) => a.seq - b.seq),
    lastEventTs,
    startTime,
    eventCount: ordered.length,
  };
}

// Phase for a fixture we have no event log for (the Bench list). Derived
// from kickoff time only: before kickoff it is upcoming, more than 3.5
// hours after kickoff it is safely finished, in between we assume live.
// The Match screen replaces this with the event-derived phase immediately.
export function phaseFromKickoff(fixture: Fixture, now: number): Phase {
  if (now < fixture.startTime) return "upcoming";
  if (now > fixture.startTime + 3.5 * 3600_000) return "finished";
  return "live";
}
