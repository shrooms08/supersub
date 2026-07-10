"use client";

// Scoreboard: teams, score, derived match minute. Grayscale on purpose;
// the volt accent belongs to the curve, the CTA, and hero numbers only.

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
    <section
      aria-label="Scoreboard"
      className="rounded-lg border border-pitch-600 bg-pitch-850 px-4 py-3"
    >
      <div className="flex items-center justify-between gap-2">
        <PhaseBadge phase={phase} replay={replay} />
        {phase === "live" && (
          <p className="text-sm font-bold tabular-nums text-chalk-100">
            {minute}&apos;
            {state?.additionalTimeMinutes ? (
              <span className="ml-1 text-chalk-400">+{state.additionalTimeMinutes}</span>
            ) : null}
          </p>
        )}
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <p className="truncate text-right text-lg font-bold text-chalk-50 sm:text-xl">
          {fixture.participant1}
        </p>
        <p className="font-display text-4xl font-black tabular-nums tracking-tight text-chalk-50 sm:text-5xl">
          {score.p1}
          <span className="px-1 text-pitch-500">:</span>
          {score.p2}
        </p>
        <p className="truncate text-left text-lg font-bold text-chalk-50 sm:text-xl">
          {fixture.participant2}
        </p>
      </div>
    </section>
  );
}
