"use client";

// On-the-pitch mode, per the reference: the volt-tinted ON THE PITCH
// banner (shirt-number square, entered minute, locked multiplier), the
// PROVISIONAL POINTS panel with the formula line and the big number
// (which dims while VAR wipes it), the red VAR alert row when the feed
// erases a goal (real events only), and, richer than the mock but real,
// the line-by-line window breakdown. Provisional points recompute from
// the fold, so rollback happens on its own.

import type { EntryRow } from "@/lib/entry";
import { fmtMultiplier, fmtPct } from "@/lib/format";
import type { WindowScore } from "@/lib/state/scoring";
import { finalPoints } from "@/lib/state/scoring";

export function OnPitchPanel({
  entry,
  provisional,
  varBanner,
  shirtNumber,
}: {
  entry: EntryRow;
  provisional: WindowScore;
  varBanner: boolean;
  shirtNumber?: number;
}) {
  const projected = finalPoints(provisional.windowPoints, entry.multiplier);
  const goalsFor = provisional.breakdown.filter((b) => b.type === "goal_for").length;

  return (
    <div className="flex flex-col gap-3">
      {/* ON THE PITCH banner */}
      <div
        className="flex items-center gap-[11px] rounded-xl px-3 py-3 lg:gap-[15px] lg:px-[17px] lg:py-[15px]"
        style={{
          background: "linear-gradient(180deg, rgba(200,255,0,.1), rgba(200,255,0,.02))",
          border: "1px solid rgba(200,255,0,.4)",
        }}
      >
        <div className="hero-number grid h-[38px] w-[38px] flex-none place-items-center rounded-lg bg-volt text-[19px] text-pitch-900 lg:h-11 lg:w-11 lg:text-[22px]">
          {shirtNumber ?? entry.team}
        </div>
        <div className="min-w-0 flex-1">
          <p className="hero-number text-[19px] uppercase leading-none text-chalk-50 lg:text-2xl">
            You&apos;re on the pitch
          </p>
          <p className="mt-1 truncate font-label text-[8px] font-semibold uppercase tracking-[0.12em] text-chalk-400 lg:text-[9px] lg:tracking-[0.14em]">
            Entered {entry.entry_minute}&apos; · {entry.team_name} · Multiplier locked{" "}
            {fmtMultiplier(entry.multiplier)}
          </p>
        </div>
        <span className="hidden font-label text-[9px] font-bold uppercase tracking-[0.16em] text-volt lg:inline">
          &#9679; Live
        </span>
      </div>

      {/* PROVISIONAL POINTS */}
      <div className="panel-quiet relative overflow-hidden !rounded-xl px-3.5 py-[13px] lg:px-[18px] lg:py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-label text-[8px] font-bold uppercase tracking-[0.16em] text-chalk-500 lg:text-[9px] lg:tracking-[0.18em]">
              Provisional points
            </p>
            <p className="mt-1 font-label text-[8px] font-semibold uppercase tracking-[0.04em] text-chalk-600 lg:text-[9px]">
              {goalsFor > 0 ? `${goalsFor} goal${goalsFor === 1 ? "" : "s"} × ` : "max(0, window) × "}
              {fmtMultiplier(entry.multiplier)} + bonuses
            </p>
          </div>
          <p
            className="hero-number text-[44px] leading-[0.8] lg:text-[56px]"
            style={{ color: varBanner ? "#f4f4f5" : "#c8ff00" }}
            aria-live="polite"
          >
            {projected}
          </p>
        </div>

        {varBanner && (
          <div
            role="status"
            className="mt-3 flex items-center gap-2.5 rounded-[9px] px-3 py-2 lg:py-[9px]"
            style={{
              background: "rgba(255,90,90,.1)",
              border: "1px solid rgba(255,90,90,.35)",
            }}
          >
            <span className="font-label text-[9px] font-bold uppercase tracking-[0.16em] text-[#ff6b6b]">
              VAR
            </span>
            <span className="font-label text-[11px] leading-[1.3] text-[#e4a1a1]">
              Goal overturned by the booth.{" "}
              <b className="text-white">The points ripped back with it.</b>
            </span>
          </div>
        )}

        {/* The window, line by line: our real breakdown (kept; the mock
            summarises, the product itemises) */}
        <ul className="mt-3 divide-y divide-white/5 border-t border-white/[0.06]">
          {provisional.breakdown.map((item, i) => (
            <li
              key={`${item.type}:${item.minute ?? "x"}:${i}`}
              className="flex items-baseline justify-between gap-3 py-2 animate-pulse-once"
            >
              <span
                className={`font-label text-xs ${
                  item.type === "goal_overturned"
                    ? "text-chalk-500 line-through"
                    : "text-chalk-300"
                }`}
              >
                {item.label}
              </span>
              <span
                className={`hero-number shrink-0 text-sm ${
                  item.points > 0 ? "text-chalk-50" : item.points < 0 ? "text-chalk-400" : "text-chalk-500"
                }`}
              >
                {item.points > 0 ? `+${item.points}` : item.points}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 font-label text-[8px] font-semibold uppercase tracking-[0.12em] text-chalk-600">
          Locked at entry: P(win) was {fmtPct(entry.win_prob_at_entry)}% at {entry.entry_minute}&apos;
        </p>
      </div>
    </div>
  );
}
