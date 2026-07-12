"use client";

// Full time, per the binding reference: staged cards. The result card
// with the window chip and the big scoreline; the multiplier card whose
// number counts up (the multiplier itself, per the reference) above the
// BASE x WINDOW = IMPACT equation; the earned badges slamming in
// staggered; then the gazette clipping. Schedule: 0.3s / 1.1s (count-up
// 1.0s) / 2.6s (stagger 120ms) / 3.6s; reduced-motion users get the
// final state at once. Resolution logic is untouched.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { EntryRow } from "@/lib/entry";
import { fmtPct, fmtPoints } from "@/lib/format";
import { tierForMultiplier } from "@/lib/config/scoring";
import { BADGES } from "@/lib/career/badges";
import { windowResult, type WindowResult } from "@/lib/career/window";
import { MatchReportCard } from "./MatchReportCard";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// Counts from 0 to target over the duration once armed.
function useCountUp(target: number, armed: boolean, durationMs = 1000): number {
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
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [armed, target, durationMs]);
  return value;
}

const STAGE_RESULT = 300;
const STAGE_MULTIPLIER = 1100;
const STAGE_BADGES = 2600;
const STAGE_REPORT = 3600;

const WDL_CHIP: Record<WindowResult, { bg: string; col: string; label: string }> = {
  W: { bg: "#e4e4e7", col: "#0a0a0c", label: "✓ Your window: win" },
  D: { bg: "#26262c", col: "#d4d4d8", label: "= Your window: draw" },
  L: { bg: "transparent", col: "#71717a", label: "✕ Your window: loss" },
};

export function ResolutionOverlay({
  entry,
  newBadges,
  resolving,
  error,
  onRetry,
  knockout = false,
  resultNote = null,
}: {
  entry: EntryRow | null;
  newBadges: string[];
  resolving: boolean;
  error: string | null;
  onRetry: () => void;
  // True when the match went past regulation (extra time or penalties):
  // shows the settlement rule under the result. Display only.
  knockout?: boolean;
  // Shootout verdict for the clipping subline, e.g. "SUI advanced on
  // penalties 4-3". Display only; scoring settled at regulation.
  resultNote?: string | null;
}) {
  const earned = newBadges
    .map((key) => BADGES.find((b) => b.key === key))
    .filter((b): b is (typeof BADGES)[number] => Boolean(b));

  const resolved = Boolean(entry?.resolved_at) && !resolving && !error;
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (!resolved) return;
    if (prefersReducedMotion()) {
      setStage(4);
      return;
    }
    setStage(0);
    const timers = [
      window.setTimeout(() => setStage(1), STAGE_RESULT),
      window.setTimeout(() => setStage(2), STAGE_MULTIPLIER),
      window.setTimeout(() => setStage(3), STAGE_BADGES),
      window.setTimeout(() => setStage(4), STAGE_REPORT),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [resolved]);

  const counted = useCountUp(entry?.multiplier ?? 0, resolved && stage >= 2);
  const wdl = entry ? windowResult(entry.breakdown) : "D";
  const goalsBanked = (entry?.breakdown ?? []).filter((b) => b.type === "goal_for").length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Full time result"
      className="fixed inset-0 z-50 overflow-y-auto bg-pitch-950/95 p-4 backdrop-blur-sm"
      style={{
        backgroundImage: "radial-gradient(500px 300px at 50% 0, rgba(200,255,0,.06), transparent 60%)",
      }}
    >
      <div className="mx-auto my-6 flex w-full max-w-md flex-col gap-3 lg:max-w-2xl lg:gap-4">
        <div className="flex items-center justify-between">
          <p className="font-label text-[9px] font-bold uppercase tracking-[0.2em] text-volt lg:text-[10px] lg:tracking-[0.24em]">
            Full time · Resolution
          </p>
          <Link
            href="/career"
            className="rounded-lg bg-volt px-3 py-2 font-label text-[9px] font-bold uppercase tracking-[0.12em] text-pitch-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50"
          >
            To career &rarr;
          </Link>
        </div>

        {resolving && (
          <div className="panel !rounded-[14px] px-6 py-10 text-center">
            <p className="font-label text-sm text-chalk-300">The ref is checking the book...</p>
            <p className="whisper mt-2">Final state only. Nothing provisional survives.</p>
          </div>
        )}

        {!resolving && error && (
          <div className="panel !rounded-[14px] px-6 py-8 text-center">
            <p className="font-label text-sm text-chalk-300">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 min-h-[44px] rounded-md border border-chalk-600 px-4 py-2 font-label text-sm font-semibold text-chalk-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50"
            >
              Ask again
            </button>
          </div>
        )}

        {resolved && entry && (
          <>
            {/* Stage 1: the result */}
            {stage >= 1 && (
              <div className="animate-reveal-up panel !rounded-[14px] bg-gradient-to-b from-pitch-800 to-pitch-900 p-4 lg:px-6 lg:py-[22px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="hero-number text-[22px] uppercase tracking-[0.04em] text-chalk-50 lg:text-[30px]">
                    Full time
                  </span>
                  <span
                    className="rounded-md px-2.5 py-[5px] font-label text-[9px] font-bold uppercase tracking-[0.12em] lg:px-3 lg:py-1.5 lg:text-[11px] lg:tracking-[0.16em]"
                    style={{
                      background: WDL_CHIP[wdl].bg,
                      color: WDL_CHIP[wdl].col,
                      border: wdl === "L" ? "1px solid #3a3a42" : "none",
                    }}
                  >
                    {WDL_CHIP[wdl].label}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-center gap-3.5 lg:mt-4 lg:gap-[26px]">
                  <span className="hero-number min-w-0 truncate text-right text-xl uppercase leading-none text-chalk-50 lg:text-[26px]">
                    {entry.team_name}
                  </span>
                  <span className="hero-number shrink-0 text-[52px] leading-[0.8] tracking-[0.04em] text-chalk-50 lg:text-[72px]">
                    {entry.final_score_team}&ndash;{entry.final_score_opp}
                  </span>
                  <span className="hero-number min-w-0 truncate text-xl uppercase leading-none text-chalk-50 lg:text-[26px]">
                    {entry.opponent_name}
                  </span>
                </div>
                <p className="mt-2.5 text-center font-label text-[9px] font-semibold uppercase tracking-[0.1em] leading-[1.4] text-chalk-400 lg:mt-3 lg:text-[10px] lg:tracking-[0.14em]">
                  Entered {entry.entry_minute}&apos; at {fmtPct(entry.win_prob_at_entry)}% ·{" "}
                  {goalsBanked} goal{goalsBanked === 1 ? "" : "s"} banked after entry
                </p>
                {(knockout || resultNote) && (
                  <p className="mt-1.5 text-center font-label text-[9px] font-semibold uppercase tracking-[0.1em] leading-[1.4] text-chalk-500 lg:text-[10px] lg:tracking-[0.14em]">
                    {resultNote ? `${resultNote} · ` : ""}Windows settle at the regulation whistle
                  </p>
                )}

                {/* The window, line by line (real breakdown, kept) */}
                <ul className="mt-3 divide-y divide-white/5 border-t border-white/[0.07]">
                  {(entry.breakdown ?? []).map((item, i) => (
                    <li key={`${item.type}:${i}`} className="flex items-baseline justify-between gap-3 py-2">
                      <span
                        className={`font-label text-xs ${
                          item.type === "goal_overturned"
                            ? "text-chalk-500 line-through"
                            : "text-chalk-300"
                        }`}
                      >
                        {item.label}
                      </span>
                      <span className="hero-number shrink-0 text-sm text-chalk-50">
                        {item.points > 0 ? `+${item.points}` : item.points}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Stage 2: the multiplier does its work */}
            {stage >= 2 && (
              <div
                className="animate-reveal-up rounded-[14px] p-[18px] text-center lg:rounded-2xl lg:p-6"
                style={{
                  background:
                    "radial-gradient(300px 160px at 50% 20%, rgba(200,255,0,.16), transparent 70%), #0b0b0e",
                  border: "1px solid rgba(200,255,0,.3)",
                }}
              >
                <p className="font-label text-[9px] font-bold uppercase tracking-[0.18em] text-chalk-500 lg:text-[10px] lg:tracking-[0.2em]">
                  {tierForMultiplier(entry.multiplier).name} multiplier
                </p>
                <p
                  className="hero-number mt-1 text-[70px] tabular-nums leading-[0.82] text-volt [text-shadow:0_0_40px_rgba(200,255,0,.5)] lg:text-[92px] lg:[text-shadow:0_0_50px_rgba(200,255,0,.5)]"
                  aria-live="polite"
                >
                  {counted.toFixed(2)}x
                </p>
                <div className="mt-2 flex items-center justify-center gap-3 lg:mt-3 lg:gap-5">
                  <div>
                    <p className="font-label text-[9px] font-semibold uppercase tracking-[0.14em] text-chalk-600">
                      Base points
                    </p>
                    <p className="hero-number text-[26px] leading-tight text-chalk-400">
                      {Math.max(0, entry.window_points ?? 0)}
                    </p>
                  </div>
                  <span className="hero-number text-[26px] text-chalk-600">&times;</span>
                  <div>
                    <p className="font-label text-[9px] font-semibold uppercase tracking-[0.14em] text-chalk-600">
                      Window
                    </p>
                    <p className="hero-number text-[26px] leading-tight text-volt">
                      {entry.multiplier.toFixed(2)}
                    </p>
                  </div>
                  <span className="hero-number text-[26px] text-chalk-600">=</span>
                  <div>
                    <p className="font-label text-[9px] font-semibold uppercase tracking-[0.14em] text-chalk-600">
                      Impact
                    </p>
                    <p className="hero-number text-[34px] leading-tight text-chalk-50">
                      +{fmtPoints(entry.final_points ?? 0)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Stage 3: badges slam in */}
            {earned.length > 0 && stage >= 3 && (
              <div>
                <p className="mb-2 font-label text-[9px] font-bold uppercase tracking-[0.16em] text-chalk-500 lg:text-[10px] lg:tracking-[0.18em]">
                  Badges earned
                </p>
                <div className="flex flex-col gap-2 lg:grid lg:grid-cols-3 lg:gap-[11px]">
                  {earned.map((badge, i) => (
                    <div
                      key={badge.key}
                      className="animate-slam-in flex items-center gap-[11px] rounded-[11px] px-[13px] py-[11px] lg:flex-col lg:gap-2 lg:rounded-[13px] lg:p-4 lg:text-center"
                      style={{
                        background: "linear-gradient(90deg, rgba(200,255,0,.1), rgba(200,255,0,.02))",
                        border: "1px solid rgba(200,255,0,.4)",
                        animationDelay: `${i * 120}ms`,
                      }}
                    >
                      <div className="hero-number grid h-[34px] w-[34px] flex-none place-items-center rounded-full bg-volt text-base text-pitch-900 shadow-[0_0_16px_rgba(200,255,0,.6)] lg:mx-auto lg:h-11 lg:w-11 lg:text-xl">
                        &#9733;
                      </div>
                      <div className="min-w-0">
                        <p className="hero-number truncate text-base uppercase leading-tight text-chalk-50 lg:text-lg">
                          {badge.name}
                        </p>
                        <p className="mt-0.5 font-label text-[8px] font-semibold uppercase tracking-[0.1em] leading-[1.3] text-chalk-400">
                          {badge.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stage 4: the morning paper */}
            {entry.report && stage >= 4 && (
              <div className="animate-reveal-up">
                <MatchReportCard entry={entry} resultNote={resultNote} />
              </div>
            )}
          </>
        )}

        {resolved && entry && stage >= 4 && (
          <Link
            href={`/match/${entry.fixture_id}/report`}
            className="block rounded-[11px] border border-white/[0.14] px-4 py-3 text-center font-label text-[11px] font-bold uppercase tracking-[0.16em] text-chalk-300 transition-colors hover:border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50"
          >
            Read the full match story &rarr;
          </Link>
        )}

        <div className="flex gap-2">
          <Link
            href="/career"
            className="block min-h-[48px] flex-1 rounded-[11px] bg-volt px-4 py-3 text-center font-display text-lg font-bold uppercase tracking-[0.05em] text-pitch-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50"
          >
            To your career &rarr;
          </Link>
          <Link
            href="/"
            className="block min-h-[48px] flex-1 rounded-[11px] border border-white/[0.14] px-4 py-3 text-center font-label text-sm font-bold uppercase tracking-wide text-chalk-300 transition-colors hover:border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50"
          >
            The bench
          </Link>
        </div>
      </div>
    </div>
  );
}
