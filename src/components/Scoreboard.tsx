"use client";

// The broadcast bug: team blocks either side of the score, the running
// clock big in the corner, phase chip up top. Condensed display face
// throughout; grayscale on purpose, the volt accent belongs to the curve,
// the CTA, and hero numbers.

import type { Fixture } from "@/lib/feed/types";
import { stateMinute, type MatchState } from "@/lib/state/fold";
import { PhaseBadge } from "./PhaseBadge";

export function Scoreboard({
  fixture,
  state,
  feedNow,
  replay,
}: {
  fixture: Fixture;
  state: MatchState | null;
  feedNow: number;
  replay: boolean;
}) {
  const phase = state?.phase ?? "upcoming";
  const minute = state ? stateMinute(state, feedNow) : 0;
  const score = state?.score ?? { p1: 0, p2: 0 };

  return (
    <section aria-label="Scoreboard" className="panel overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-pitch-700 px-4 py-1.5">
        <span className="flex items-center gap-2">
          <PhaseBadge phase={phase} replay={replay} />
          <span className="label hidden sm:inline">{fixture.competition || "Football"}</span>
        </span>
        <p
          className="hero-number text-2xl leading-none text-chalk-50"
          aria-label={`Match minute ${minute}`}
        >
          {phase === "upcoming" ? "--'" : `${minute}'`}
          {phase === "live" && state?.additionalTimeMinutes ? (
            <span className="ml-1 text-base text-chalk-400">+{state.additionalTimeMinutes}</span>
          ) : null}
        </p>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch">
        <div className="flex items-center justify-end bg-pitch-850 px-3 py-4 sm:px-5">
          <p className="display-condensed truncate text-right font-display text-xl font-black uppercase tracking-tight text-chalk-50 sm:text-2xl">
            {fixture.participant1}
          </p>
        </div>
        <div className="flex items-center justify-center gap-1 border-x border-pitch-700 bg-pitch-900 px-4 sm:px-6">
          <span className="hero-number text-5xl leading-none text-chalk-50 sm:text-6xl">
            {score.p1}
          </span>
          <span aria-hidden className="hero-number px-0.5 text-3xl leading-none text-pitch-500">
            :
          </span>
          <span className="hero-number text-5xl leading-none text-chalk-50 sm:text-6xl">
            {score.p2}
          </span>
        </div>
        <div className="flex items-center justify-start bg-pitch-850 px-3 py-4 sm:px-5">
          <p className="display-condensed truncate font-display text-xl font-black uppercase tracking-tight text-chalk-50 sm:text-2xl">
            {fixture.participant2}
          </p>
        </div>
      </div>
    </section>
  );
}
