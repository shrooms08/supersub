"use client";

// A fixture on the matchday slate: competition tag, kickoff with a live
// countdown, phase chip, and your result strip once you have played it.
// The countdown renders from a `now` passed down by the page, which runs
// ONE shared 1s interval for every card; tabular numerals so ticking
// never shifts layout.

import Link from "next/link";
import type { FixtureListing } from "@/lib/sources/types";
import type { FixtureResult } from "@/app/api/matchday/route";
import { PhaseBadge } from "./PhaseBadge";
import { fmtKickoffUtc, fmtMultiplier, fmtPoints } from "@/lib/format";

function countdownLabel(startTime: number, now: number): string {
  const remaining = startTime - now;
  if (remaining <= 0) return "Any minute";
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const s = Math.floor((remaining % 60_000) / 1_000);
  if (h > 0) return `T-${h}h ${String(m).padStart(2, "0")}m`;
  return `T-${m}m ${String(s).padStart(2, "0")}s`;
}

const WDL_LABEL: Record<string, string> = {
  W: "Window won",
  D: "Window drawn",
  L: "Window lost",
};

export function FixtureCard({
  listing,
  result,
  href,
  now,
}: {
  listing: FixtureListing;
  result: FixtureResult | null;
  href: string;
  now: number;
}) {
  const { fixture, phase, mode } = listing;
  const playable = phase === "live" || mode === "replay";
  const isReplay = mode === "replay";

  const inner = (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-pitch-700/70 px-4 py-1.5">
        <span className="label">{fixture.competition || "Football"}</span>
        <span className="flex items-center gap-2">
          {phase === "upcoming" && !isReplay && (
            <span className="flex items-baseline gap-1.5">
              <span className="font-label text-[8px] font-bold uppercase tracking-[0.16em] text-chalk-600">
                Kicks off in
              </span>
              <span className="hero-number text-sm tabular-nums leading-none text-chalk-300">
                {countdownLabel(fixture.startTime, now)}
              </span>
            </span>
          )}
          <PhaseBadge phase={phase} replay={isReplay} />
        </span>
      </div>

      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="min-w-0">
          <p className="hero-number truncate text-[22px] uppercase leading-none tracking-[0.02em] text-chalk-50">
            {fixture.participant1}
            <span className="px-1.5 font-normal normal-case text-chalk-500">v</span>
            {fixture.participant2}
          </p>
          <p className="whisper mt-1.5">{fmtKickoffUtc(fixture.startTime)}</p>
        </div>
        {!result && playable && (
          <span className="shrink-0 font-label text-[11px] font-bold uppercase tracking-[0.14em] text-chalk-300">
            {phase === "upcoming" && isReplay
              ? "Kick it off"
              : phase === "finished" && isReplay
                ? "Watch back"
                : "In the tunnel"}
            <span aria-hidden> &rsaquo;</span>
          </span>
        )}
      </div>

      {result && (
        <div className="flex items-center justify-between gap-3 border-t border-pitch-700/70 bg-pitch-900/70 px-4 py-2">
          <span className="font-label text-xs font-bold uppercase tracking-[0.12em] text-chalk-300">
            {WDL_LABEL[result.wdl]} · {result.tierName} {fmtMultiplier(result.multiplier)}
          </span>
          <span className="hero-number shrink-0 text-xl leading-none text-chalk-50">
            {fmtPoints(result.points)}
            <span className="ml-1 font-label text-xs font-bold text-chalk-500">pts</span>
          </span>
        </div>
      )}
    </>
  );

  return playable ? (
    <Link
      href={href}
      className="panel panel-hover block overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50"
    >
      {inner}
    </Link>
  ) : (
    <div className="panel-quiet overflow-hidden opacity-75">{inner}</div>
  );
}
