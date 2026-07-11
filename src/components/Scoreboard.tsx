"use client";

// The broadcast bug, per the binding reference: pinstriped team code
// blocks, big flanking scores, centre column with the LIVE chip, the
// tabular clock, and the period label. Team codes derive from the real
// team names; HOME/AWAY from the feed's home flag. The parent pins this
// in one sticky stack with the on-pitch strip.

import type { Fixture } from "@/lib/feed/types";
import { stateMinute, type MatchState } from "@/lib/state/fold";
import { PhaseBadge } from "./PhaseBadge";

function code(name: string): string {
  return name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "---";
}

function periodLabel(state: MatchState | null): string {
  if (!state) return "Kickoff soon";
  if (state.phase === "finished") return "Full time";
  switch (state.statusId) {
    case 2:
      return "First half";
    case 3:
      return "Half time";
    case 4:
      return "Second half";
    case 5:
      return "Full time";
    default:
      return state.phase === "live" ? "In play" : "Kickoff soon";
  }
}

function TeamBlock({
  name,
  home,
  right,
  stripes,
}: {
  name: string;
  home: boolean;
  right?: boolean;
  stripes: string;
}) {
  return (
    <div className={`flex items-center gap-[11px] ${right ? "flex-row-reverse" : ""}`}>
      <div
        aria-hidden
        className="grid h-9 w-9 flex-none place-items-center rounded-[9px] border border-white/10 bg-[#17171c] font-display text-base font-bold sm:h-[46px] sm:w-[46px] sm:text-xl"
        style={{ backgroundImage: stripes }}
      >
        {code(name)}
      </div>
      <div className={`hidden sm:block ${right ? "text-right" : ""}`}>
        <p className="hero-number max-w-[130px] truncate text-[15px] uppercase leading-none text-chalk-50">
          {name}
        </p>
        <p className="mt-[3px] font-label text-[8px] font-semibold uppercase tracking-[0.16em] text-chalk-600">
          {home ? "Home" : "Away"}
        </p>
      </div>
    </div>
  );
}

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
      className="flex items-center justify-center gap-4 rounded-2xl border-b-2 border-b-volt bg-gradient-to-b from-pitch-800 to-pitch-900 px-3 py-3 shadow-[0_10px_30px_-18px_#000,inset_0_1px_0_rgba(255,255,255,.05)] sm:gap-[26px] sm:px-6 sm:py-3.5"
      style={{ border: "1px solid rgba(255,255,255,.07)", borderBottom: "2px solid #c8ff00" }}
    >
      <TeamBlock
        name={fixture.participant1}
        home={fixture.participant1IsHome}
        stripes="repeating-linear-gradient(90deg, transparent 0 6px, rgba(255,255,255,.05) 6px 7px)"
      />
      <span className="hero-number text-4xl leading-none text-chalk-50 sm:text-5xl">
        {score.p1}
      </span>

      <div className="min-w-[86px] text-center sm:min-w-[96px]">
        <span className="inline-flex items-center">
          <PhaseBadge phase={phase} replay={replay} />
        </span>
        <p
          className="hero-number mt-1 text-[30px] tabular-nums leading-[0.9] text-chalk-50 sm:text-[42px]"
          aria-label={`Match minute ${minute}`}
        >
          {phase === "upcoming" ? "--'" : `${minute}'`}
        </p>
        <p className="mt-0.5 font-label text-[8px] font-semibold uppercase tracking-[0.16em] text-chalk-600">
          {periodLabel(state)}
          {phase === "live" && state?.additionalTimeMinutes
            ? ` · +${state.additionalTimeMinutes}`
            : ""}
        </p>
      </div>

      <span className="hero-number text-4xl leading-none text-chalk-50 sm:text-5xl">
        {score.p2}
      </span>
      <TeamBlock
        name={fixture.participant2}
        home={!fixture.participant1IsHome}
        right
        stripes="repeating-linear-gradient(0deg, transparent 0 6px, rgba(255,255,255,.05) 6px 7px)"
      />
    </section>
  );
}
