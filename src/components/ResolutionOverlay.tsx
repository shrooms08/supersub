"use client";

// Full time. Resolution takes over the screen in stages, like the numbers
// going up on the board: the window result first, then the multiplier
// counts the final score up, then anything new for the cabinet slams in,
// then the match report card. Whole sequence under six seconds, CSS and
// requestAnimationFrame only, and reduced-motion users get everything at
// once.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { EntryRow } from "@/lib/entry";
import { fmtMultiplier, fmtPct, fmtPoints } from "@/lib/format";
import { tierForMultiplier } from "@/lib/config/scoring";
import { BADGES } from "@/lib/career/badges";
import { MatchReportCard } from "./MatchReportCard";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// Counts from 0 to target over the duration once armed.
function useCountUp(target: number, armed: boolean, durationMs = 1400): number {
  const [value, setValue] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    if (!armed) return;
    if (prefersReducedMotion() || target === 0) {
      setValue(target);
      return;
    }
    const startedAt = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / durationMs);
      // ease-out cubic: fast start, settles like a scoreboard.
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased * 10) / 10);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [armed, target, durationMs]);
  return value;
}

// Reveal schedule, ms from the resolved row arriving.
const STAGE_MULTIPLIER = 1100;
const STAGE_BADGES = 3100;
const STAGE_REPORT = 3900;

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

  const resolved = Boolean(entry?.resolved_at) && !resolving && !error;
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (!resolved) return;
    if (prefersReducedMotion()) {
      setStage(3);
      return;
    }
    setStage(0);
    const timers = [
      window.setTimeout(() => setStage(1), STAGE_MULTIPLIER),
      window.setTimeout(() => setStage(2), STAGE_BADGES),
      window.setTimeout(() => setStage(3), STAGE_REPORT),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [resolved]);

  const finalTarget = entry?.final_points ?? 0;
  const counted = useCountUp(finalTarget, resolved && stage >= 1);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Full time result"
      className="fixed inset-0 z-50 overflow-y-auto bg-pitch-950/95 p-4 backdrop-blur-sm"
    >
      <div className="panel mx-auto my-6 w-full max-w-md overflow-hidden bg-pitch-900 shadow-2xl">
        <div className="border-b border-pitch-700 px-6 py-4 text-center">
          <p className="display-expanded font-display text-2xl font-black uppercase tracking-[0.2em] text-chalk-50">
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
            <p className="whisper mt-2">Final state only. Nothing provisional survives.</p>
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

        {resolved && entry && (
          <>
            {/* Stage 0: the window, line by line */}
            <div className="animate-rise-in">
              <ul className="divide-y divide-pitch-800">
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
                <li className="flex items-baseline justify-between gap-3 bg-pitch-850 px-6 py-2.5">
                  <span className="label">The window</span>
                  <span className="font-display text-sm font-black tabular-nums text-chalk-50">
                    {entry.window_points}
                  </span>
                </li>
              </ul>
            </div>

            {/* Stage 1: the multiplier does its work */}
            <div
              className={`border-t border-pitch-700 px-6 py-6 text-center transition-opacity duration-300 ${
                stage >= 1 ? "opacity-100" : "opacity-0"
              }`}
              aria-hidden={stage < 1}
            >
              <p className="whisper">
                max(0, {entry.window_points}) x {fmtMultiplier(entry.multiplier)} ·{" "}
                {tierForMultiplier(entry.multiplier).name}
              </p>
              <p className="hero-number mt-1 text-7xl leading-none text-volt" aria-live="polite">
                {fmtPoints(stage >= 1 ? counted : 0)}
              </p>
              <p className="mt-2 text-xs text-chalk-500">
                You came on at {entry.entry_minute}&apos; with P(win){" "}
                {fmtPct(entry.win_prob_at_entry)}%. Locked then, settled now.
              </p>
            </div>

            {/* Stage 2: into the cabinet */}
            {badgeNames.length > 0 && stage >= 2 && (
              <div className="animate-slam-in border-t border-pitch-700 bg-pitch-850 px-6 py-3 text-center">
                <p className="label">Into the cabinet</p>
                <p className="display-condensed mt-1 font-display text-lg font-black uppercase tracking-wide text-chalk-50">
                  {badgeNames.join(" · ")}
                </p>
              </div>
            )}

            {/* Stage 3: the morning paper */}
            {entry.report && stage >= 3 && (
              <div className="animate-rise-in border-t border-pitch-700 px-4 py-4">
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
