// Internal feed types. Everything downstream of src/lib/feed/normalize.ts
// speaks these shapes and nothing else. Raw TxLINE payloads (PascalCase
// historical, camelCase live, or vice versa) never leave the normalization
// layer.

export type Phase = "upcoming" | "live" | "finished";

export interface Fixture {
  fixtureId: number;
  startTime: number;
  competition: string;
  participant1: string;
  participant2: string;
  participant1Id?: number;
  participant2Id?: number;
  participant1IsHome: boolean;
}

// Cumulative per-team counters. Normalization zero-fills these: in the raw
// feed an absent key means zero, not unchanged (spike finding, risk 2).
export interface TeamCounters {
  goals: number;
  corners: number;
  yellowCards: number;
  redCards: number;
}

export interface MatchClock {
  running: boolean;
  seconds: number;
}

export interface MatchEvent {
  fixtureId: number;
  seq: number;
  // Action id. Stable across the unconfirmed/confirmed/amended lifecycle of
  // one real-world action; action_discarded points at this id to erase it.
  id: number;
  ts: number;
  action: string;
  statusId?: number;
  confirmed?: boolean;
  participant?: number;
  clock?: MatchClock;
  // Present only when the raw event carried a per-participant Score entry.
  // A present entry is authoritative and zero-filled; an absent entry means
  // "no information", carry the previous baseline forward.
  score?: { p1?: TeamCounters; p2?: TeamCounters };
  // Penalty shootout tally from the Score map's PE period, which the feed
  // keeps out of Total. Display only: shootout kicks never score windows.
  shootoutScore?: { p1: number; p2: number };
  data?: Record<string, unknown>;
  startTime?: number;
}

export interface OddsUpdate {
  fixtureId: number;
  ts: number;
  // Feed message id when the payload carried one; used to dedupe when a
  // snapshot and an interval backfill overlap.
  messageId?: string;
  superOddsType: string;
  marketPeriod: string | null;
  inRunning: boolean;
  priceNames: string[];
  // Decimal odds in thousandths (1657 means 1.657). Empty array means the
  // market is suspended: hold the last value (spike finding, risk 6).
  prices: number[];
  // The feed's own demargined percentages as strings; "NA" when absent.
  pct: string[];
}

// One point of the win probability time series, keyed by feed timestamp.
export interface ProbTick {
  ts: number;
  p1: number;
  draw: number;
  p2: number;
  // True while the market is suspended; values are held from the last
  // tradable tick.
  suspended: boolean;
}
