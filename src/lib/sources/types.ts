// The internal match source interface (binding: the entire app runs
// identically against the replay source and the live source; nothing
// downstream knows which one it is talking to).

import type { Fixture, MatchEvent, OddsUpdate, Phase } from "@/lib/feed/types";

export type Mode = "replay" | "live";

export interface SourceMeta {
  mode: Mode;
  // Feed-time seconds advance per wall-clock second. 1 for live.
  speed: number;
  fixture: Fixture;
  virtualNow: number;
}

export interface FixtureListing {
  fixture: Fixture;
  phase: Phase;
  mode: Mode;
}

export interface SourceCallbacks {
  onMeta(meta: SourceMeta): void;
  // Full normalized log up to "now" (requirement 4: join and reconnect
  // reconstruct state before streaming). Odds are 1X2 full-time only.
  onBackfill(payload: { events: MatchEvent[]; odds: OddsUpdate[] }): void;
  onEvent(event: MatchEvent): void;
  onOdds(odds: OddsUpdate): void;
  // Periodic feed-time heartbeat; drives the derived match minute and the
  // advancing edge of the win probability curve.
  onClock(feedNow: number): void;
  onError(message: string): void;
}

export interface MatchLog {
  fixture: Fixture;
  events: MatchEvent[];
  odds: OddsUpdate[];
}

export interface MatchSource {
  mode: Mode;
  listFixtures(): Promise<FixtureListing[]>;
  getFixture(fixtureId: number): Promise<Fixture | null>;
  // The ordered normalized log up to a feed timestamp (or everything the
  // source can see when omitted). Used by the enter and resolve endpoints,
  // which run in separate invocations from the stream and therefore
  // reconstruct state on their own.
  getLog(fixtureId: number, upToFeedTs?: number): Promise<MatchLog>;
  // Current feed time for this fixture: virtual clock in replay, wall
  // clock in live.
  feedNow(fixtureId: number): Promise<number>;
  // Stream until the signal aborts.
  connect(fixtureId: number, cb: SourceCallbacks, signal: AbortSignal): Promise<void>;
}
