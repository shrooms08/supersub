// World Cup only. The product ships the official tournament; the feed also
// carries Friendlies (competition 430), which must never appear on the
// bench, in the results history, or on any match path. Every fixture-source
// choke point filters the normalized snapshot through isWorldCup, so the
// competition id is the single gate and the rest of the app only ever sees
// World Cup fixtures.
//
// Read-only: this is a display/source filter, not a scoring or schema
// change. Bundled replays are the three World Cup demo fixtures and are
// admitted by their own path (they never flow through this filter), so a
// reconstructed replay fixture without a competition id is still fine.

import type { Fixture } from "@/lib/feed/types";

// Feed competition id for the World Cup (Friendlies are 430).
export const WORLD_CUP_COMPETITION_ID = 72;

export function isWorldCup(fixture: Fixture): boolean {
  return fixture.competitionId === WORLD_CUP_COMPETITION_ID;
}
