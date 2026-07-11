"use client";

// A fixture on the slate, per the reference: competition label and phase
// chip up top, the two sides in Saira with a centre block (countdown for
// genuinely upcoming fixtures; kickoff stamp otherwise, since our bench
// data carries no live score without an API change), then a YOUR RESULT
// strip once played, or the ENTER THE MATCH action for playable
// fixtures, or the dashed lineups row for upcoming live ones. The
// countdown ticks off ONE shared clock owned by the page.

import Link from "next/link";
import type { FixtureListing } from "@/lib/sources/types";
import type { FixtureResult } from "@/app/api/matchday/route";
import { PhaseBadge } from "./PhaseBadge";
import { fmtKickoffUtc, fmtMultiplier, fmtPoints } from "@/lib/format";
import type { WindowResult } from "@/lib/career/window";

function countdownLabel(startTime: number, now: number): string {
  const remaining = startTime - now;
  if (remaining <= 0) return "00:00:00";
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const s = Math.floor((remaining % 60_000) / 1_000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const WDL_CHIP: Record<WindowResult, { bg: string; col: string; bd: string }> = {
  W: { bg: "#e4e4e7", col: "#0a0a0c", bd: "transparent" },
  D: { bg: "#26262c", col: "#d4d4d8", bd: "transparent" },
  L: { bg: "transparent", col: "#52525b", bd: "#3a3a42" },
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
  const upcomingLive = phase === "upcoming" && !isReplay;

  const inner = (
    <div className="px-[13px] py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-label text-[9px] font-semibold uppercase tracking-[0.16em] text-chalk-600">
          {fixture.competition || "Football"}
        </span>
        <PhaseBadge phase={phase} replay={isReplay} />
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-3">
        <span className="hero-number min-w-0 flex-1 truncate text-[22px] uppercase leading-none tracking-[0.02em] text-chalk-50">
          {fixture.participant1}
        </span>
        <span className="shrink-0 text-center">
          {upcomingLive ? (
            <>
              <span className="block font-label text-[8px] font-bold uppercase tracking-[0.16em] text-chalk-600">
                Kicks off in
              </span>
              <span className="hero-number mt-0.5 block text-[22px] tabular-nums leading-none tracking-[0.04em] text-chalk-300">
                {countdownLabel(fixture.startTime, now)}
              </span>
            </>
          ) : (
            <>
              <span className="block font-label text-[8px] font-bold uppercase tracking-[0.16em] text-chalk-600">
                {isReplay ? "Replay · Kicked off" : "Kickoff"}
              </span>
              <span className="hero-number mt-0.5 block text-sm uppercase leading-none text-chalk-400">
                {fmtKickoffUtc(fixture.startTime)}
              </span>
            </>
          )}
        </span>
        <span className="hero-number min-w-0 flex-1 truncate text-right text-[22px] uppercase leading-none tracking-[0.02em] text-chalk-50">
          {fixture.participant2}
        </span>
      </div>

      {result && (
        <div className="mt-[11px] flex items-center gap-2 border-t border-white/[0.06] pt-2.5">
          <span className="font-label text-[8px] font-bold uppercase tracking-[0.14em] text-chalk-600">
            Your result
          </span>
          <span className="font-label text-[10px] font-semibold uppercase tracking-[0.1em] text-chalk-400">
            {result.tierName}
          </span>
          <span className="hero-number text-sm leading-none text-chalk-300">
            {fmtMultiplier(result.multiplier)}
          </span>
          <span className="hero-number ml-auto text-[15px] leading-none text-chalk-50">
            {fmtPoints(result.points)}
          </span>
          <span
            className="grid h-[19px] w-[19px] shrink-0 place-items-center rounded-[5px] font-label text-[10px] font-bold"
            style={{
              background: WDL_CHIP[result.wdl].bg,
              color: WDL_CHIP[result.wdl].col,
              border: `1px solid ${WDL_CHIP[result.wdl].bd}`,
            }}
          >
            {result.wdl}
          </span>
        </div>
      )}

      {!result && playable && (
        <span
          className="mt-[11px] block rounded-[9px] py-[9px] text-center font-label text-[10px] font-bold uppercase tracking-[0.16em] text-volt"
          style={{ border: "1px solid rgba(200,255,0,.5)", background: "rgba(200,255,0,.1)" }}
        >
          {phase === "finished" && isReplay ? "Watch it back →" : "Enter the match →"}
        </span>
      )}

      {!result && upcomingLive && (
        <span className="mt-[11px] block rounded-[9px] border border-dashed border-white/10 py-2 text-center font-label text-[9px] font-semibold uppercase tracking-[0.14em] text-chalk-600">
          Lineups drop at kickoff · Set your entry
        </span>
      )}
    </div>
  );

  return playable ? (
    <Link
      href={href}
      className="panel panel-hover block overflow-hidden !rounded-[14px] !bg-[#0d0d10] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50"
    >
      {inner}
    </Link>
  ) : (
    <div className="panel-quiet overflow-hidden !rounded-[14px] opacity-80">{inner}</div>
  );
}
