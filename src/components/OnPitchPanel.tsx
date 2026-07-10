"use client";

// "On the pitch" mode: provisional points accumulating from window events,
// recomputed from the fold on every update, so a VAR overturn rolls the
// number back on its own. The banner makes the rollback impossible to
// miss.

import type { EntryRow } from "@/lib/entry";
import { fmtMultiplier, fmtPct, fmtPoints } from "@/lib/format";
import type { WindowScore } from "@/lib/state/scoring";
import { finalPoints } from "@/lib/state/scoring";

export function OnPitchPanel({
  entry,
  provisional,
  varBanner,
}: {
  entry: EntryRow;
  provisional: WindowScore;
  varBanner: boolean;
}) {
  const projected = finalPoints(provisional.windowPoints, entry.multiplier);

  return (
    <section
      aria-label="Your shift"
      className="relative overflow-hidden rounded-lg border border-pitch-600 bg-pitch-850"
    >
      {varBanner && (
        <div
          role="status"
          className="absolute inset-x-0 top-0 z-10 animate-var-flash bg-pitch-950/95 px-4 py-3 text-center"
        >
          <p className="font-display text-lg font-black uppercase tracking-widest text-chalk-50">
            VAR: overturned
          </p>
          <p className="text-xs text-chalk-400">The board giveth, the booth taketh away.</p>
        </div>
      )}

      <div className="border-b border-pitch-700 px-4 py-3">
        <p className="whisper">
          You are on for {entry.team_name} since {entry.entry_minute}&apos;. Everything from here
          counts.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-px bg-pitch-700">
        <div className="bg-pitch-850 px-4 py-4">
          <p className="whisper">Provisional</p>
          <p className="hero-number text-5xl text-volt" aria-live="polite">
            {fmtPoints(projected)}
          </p>
          <p className="mt-1 text-xs tabular-nums text-chalk-500">
            max(0, {provisional.windowPoints}) x {fmtMultiplier(entry.multiplier)}
          </p>
        </div>
        <div className="bg-pitch-850 px-4 py-4">
          <p className="whisper">Locked at entry</p>
          <p className="hero-number text-5xl text-chalk-50">{fmtMultiplier(entry.multiplier)}</p>
          <p className="mt-1 text-xs tabular-nums text-chalk-500">
            P(win) was {fmtPct(entry.win_prob_at_entry)}% at {entry.entry_minute}&apos;
          </p>
        </div>
      </div>

      <ul className="divide-y divide-pitch-800 border-t border-pitch-700">
        {provisional.breakdown.map((item, i) => (
          <li
            key={`${item.type}:${item.minute ?? "x"}:${i}`}
            className="flex items-baseline justify-between gap-3 px-4 py-2 animate-pulse-once"
          >
            <span
              className={`text-sm ${
                item.type === "goal_overturned"
                  ? "text-chalk-500 line-through"
                  : "text-chalk-200"
              }`}
            >
              {item.label}
            </span>
            <span
              className={`shrink-0 text-sm font-bold tabular-nums ${
                item.points > 0
                  ? "text-chalk-50"
                  : item.points < 0
                    ? "text-chalk-400"
                    : "text-chalk-500"
              }`}
            >
              {item.points > 0 ? `+${item.points}` : item.points}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
