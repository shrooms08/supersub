"use client";

// The three bundled replay cards for the judges' door. Each uses the
// shared FixtureCard in its REPLAY READY presentation (truthful chip,
// REPLAY THE MATCH action) and links into replay mode at 8x, the pace
// that feels live rather than time-lapsed.

import { FixtureCard } from "./FixtureCard";
import type { FixtureListing } from "@/lib/sources/types";

export function JudgesReplays({ listings }: { listings: FixtureListing[] }) {
  if (listings.length === 0) {
    return (
      <p className="text-center font-label text-sm text-chalk-400">
        No replay bundles are loaded.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {listings.map((listing) => (
        <FixtureCard
          key={listing.fixture.fixtureId}
          listing={listing}
          result={null}
          href={`/match/${listing.fixture.fixtureId}?mode=replay&speed=8`}
          now={0}
          replayReady
        />
      ))}
    </div>
  );
}
