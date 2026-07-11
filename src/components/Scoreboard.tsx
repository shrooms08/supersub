"use client";

// The broadcast bug: home / clock+score / away in three columns, the
// clock big and tabular so it never shifts layout, a 2px volt keyline
// along the bottom edge. The parent pins it (plus the on-pitch window
// strip) in ONE sticky stack; this component is layout-only.

import type { Fixture } from "@/lib/feed/types";
import { stateMinute, type MatchState } from "@/lib/state/fold";
import { PhaseBadge } from "./PhaseBadge";

// The bug's center column is tight on a phone; real names go either side,
// the center shows the score and clock only.
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
    <section
      aria-label="Scoreboard"
      className="panel overflow-hidden border-b-2 !border-b-volt"
    >
      <div className="flex items-center justify-between gap-2 border-b border-pitch-700 px-4 py-1.5">
        <span className="flex items-center gap-2">
          <PhaseBadge phase={phase} replay={replay} />
          <span className="label hidden sm:inline">{fixture.competition || "Football"}</span>
        </span>
        {state?.additionalTimeMinutes && phase === "live" ? (
          <span className="label">+{state.additionalTimeMinutes} added</span>
        ) : null}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch">
        <div className="flex items-center justify-end bg-pitch-850 px-3 py-3 sm:px-5">
          <p className="hero-number truncate text-right text-xl uppercase leading-none text-chalk-50 sm:text-2xl">
            {fixture.participant1}
          </p>
        </div>
        <div className="flex flex-col items-center justify-center border-x border-pitch-700 bg-pitch-900 px-4 py-1.5 sm:px-6">
          <p
            className="hero-number text-[44px] leading-none text-chalk-50"
            aria-label={`Match minute ${minute}`}
          >
            {phase === "upcoming" ? "--'" : `${minute}'`}
          </p>
          <p className="hero-number mt-0.5 text-2xl leading-none text-chalk-100">
            {score.p1}
            <span aria-hidden className="px-1 text-pitch-500">
              -
            </span>
            {score.p2}
          </p>
        </div>
        <div className="flex items-center justify-start bg-pitch-850 px-3 py-3 sm:px-5">
          <p className="hero-number truncate text-xl uppercase leading-none text-chalk-50 sm:text-2xl">
            {fixture.participant2}
          </p>
        </div>
      </div>
    </section>
  );
}
