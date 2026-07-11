"use client";

// A fixture on the matchday slate: competition tag, kickoff with a live
// countdown, phase chip, and your result strip once you have played it.

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FixtureListing } from "@/lib/sources/types";
import type { FixtureResult } from "@/app/api/matchday/route";
import { PhaseBadge } from "./PhaseBadge";
import { fmtKickoffUtc, fmtMultiplier, fmtPoints } from "@/lib/format";

// T-2h 14m, ticking. Live-mode upcoming fixtures only; a replay's
// StartTime is history, so those read as on-demand instead.
function Countdown({ startTime }: { startTime: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  const remaining = startTime - now;
  if (remaining <= 0) {
    return <span className="text-xs font-bold uppercase tracking-[0.14em] text-chalk-200">Any minute now</span>;
  }
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.ceil((remaining % 3_600_000) / 60_000);
  return (
    <span className="text-xs font-bold uppercase tracking-[0.14em] tabular-nums text-chalk-200">
      T-{h > 0 ? `${h}h ` : ""}
      {m}m
    </span>
  );
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
}: {
  listing: FixtureListing;
  result: FixtureResult | null;
  href: string;
}) {
  const { fixture, phase, mode } = listing;
  const playable = phase === "live" || mode === "replay";
  const isReplay = mode === "replay";

  const inner = (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-pitch-700/70 px-4 py-1.5">
        <span className="label">{fixture.competition || "Football"}</span>
        <span className="flex items-center gap-2">
          {phase === "upcoming" && !isReplay && <Countdown startTime={fixture.startTime} />}
          <PhaseBadge phase={phase} replay={isReplay} />
        </span>
      </div>

      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="min-w-0">
          <p className="display-condensed truncate font-display text-xl font-black uppercase tracking-tight text-chalk-50">
            {fixture.participant1}
            <span className="px-1.5 font-normal normal-case text-chalk-500">v</span>
            {fixture.participant2}
          </p>
          <p className="whisper mt-1">{fmtKickoffUtc(fixture.startTime)}</p>
        </div>
        {!result && playable && (
          <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.14em] text-chalk-300">
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
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-chalk-300">
            {WDL_LABEL[result.wdl]} · {result.tierName} {fmtMultiplier(result.multiplier)}
          </span>
          <span className="hero-number shrink-0 text-xl leading-none text-chalk-50">
            {fmtPoints(result.points)}
            <span className="ml-1 text-xs font-bold text-chalk-500">pts</span>
          </span>
        </div>
      )}
    </>
  );

  return playable ? (
    <Link
      href={href}
      className="panel panel-hover block overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt"
    >
      {inner}
    </Link>
  ) : (
    <div className="panel-quiet overflow-hidden opacity-75">{inner}</div>
  );
}
