"use client";

// Full time. Resolution takes over the screen: final points huge, the
// multiplier with its tier name, the line-by-line story of the shift,
// anything new for the cabinet, and the match report clipping below the
// breakdown.

import Link from "next/link";
import type { EntryRow } from "@/lib/entry";
import { fmtMultiplier, fmtPct, fmtPoints } from "@/lib/format";
import { tierForMultiplier } from "@/lib/config/scoring";
import { BADGES } from "@/lib/career/badges";
import { MatchReportCard } from "./MatchReportCard";

export function ResolutionOverlay({
  entry,
  newBadges,
  resolving,
  error,
  onRetry,
}: {
  entry: EntryRow | null;
  newBadges: string[];
  resolving: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const badgeNames = newBadges
    .map((key) => BADGES.find((b) => b.key === key)?.name)
    .filter((n): n is string => Boolean(n));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Full time result"
      className="fixed inset-0 z-50 overflow-y-auto bg-pitch-950/95 p-4 backdrop-blur-sm"
    >
      <div className="mx-auto my-6 w-full max-w-md rounded-xl border border-pitch-600 bg-pitch-900 shadow-2xl">
        <div className="border-b border-pitch-700 px-6 py-4 text-center">
          <p className="font-display text-2xl font-black uppercase tracking-[0.2em] text-chalk-50">
            Full time
          </p>
          {entry?.resolved_at && (
            <p className="whisper mt-1">
              {entry.team_name} {entry.final_score_team} - {entry.final_score_opp}{" "}
              {entry.opponent_name}
            </p>
          )}
        </div>

        {resolving && (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-chalk-300">The ref is checking the book...</p>
          </div>
        )}

        {!resolving && error && (
          <div className="px-6 py-8 text-center">
            <p className="text-sm text-chalk-300">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 min-h-[44px] rounded-md border border-chalk-600 px-4 py-2 text-sm font-semibold text-chalk-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt"
            >
              Ask again
            </button>
          </div>
        )}

        {!resolving && !error && entry?.resolved_at && (
          <>
            <div className="px-6 py-6 text-center">
              <p className="whisper">Your final score</p>
              <p className="hero-number text-7xl text-volt">
                {fmtPoints(entry.final_points ?? 0)}
              </p>
              <p className="mt-2 text-sm tabular-nums text-chalk-400">
                max(0, {entry.window_points}) window points x{" "}
                <span className="font-bold text-chalk-100">{fmtMultiplier(entry.multiplier)}</span>
              </p>
              <p className="mt-1 text-xs text-chalk-500">
                {tierForMultiplier(entry.multiplier).name}. You came on at {entry.entry_minute}
                &apos; with P(win) {fmtPct(entry.win_prob_at_entry)}%.
              </p>
            </div>

            <ul className="divide-y divide-pitch-800 border-t border-pitch-700">
              {(entry.breakdown ?? []).map((item, i) => (
                <li
                  key={`${item.type}:${i}`}
                  className="flex items-baseline justify-between gap-3 px-6 py-2.5"
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
                  <span className="shrink-0 text-sm font-bold tabular-nums text-chalk-50">
                    {item.points > 0 ? `+${item.points}` : item.points}
                  </span>
                </li>
              ))}
            </ul>

            {badgeNames.length > 0 && (
              <div className="border-t border-pitch-700 px-6 py-3">
                <p className="whisper">Into the cabinet</p>
                <p className="mt-1 text-sm font-bold text-chalk-100">{badgeNames.join(" · ")}</p>
              </div>
            )}

            {entry.report && (
              <div className="border-t border-pitch-700 px-4 py-4">
                <MatchReportCard entry={entry} />
              </div>
            )}
          </>
        )}

        <div className="flex gap-2 border-t border-pitch-700 px-6 py-4">
          <Link
            href="/career"
            className="block min-h-[48px] flex-1 rounded-md border border-chalk-600 px-4 py-3 text-center text-sm font-bold uppercase tracking-wide text-chalk-100 transition-colors hover:border-chalk-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt"
          >
            The career
          </Link>
          <Link
            href="/"
            className="block min-h-[48px] flex-1 rounded-md border border-pitch-600 px-4 py-3 text-center text-sm font-bold uppercase tracking-wide text-chalk-300 transition-colors hover:border-chalk-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt"
          >
            The bench
          </Link>
        </div>
      </div>
    </div>
  );
}
