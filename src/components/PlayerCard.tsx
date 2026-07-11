"use client";

// The contracted-player card, per the reference: pinstriped panel,
// CONTRACTED eyebrow, crest + name row, IMPACT RATING at 54px volt below
// a hairline, the form chips, and the NEXT BADGE panel with a volt
// progress bar where the badge has countable progress (appearance-based
// badges); other badges tease with copy alone. Links to the career.

import Link from "next/link";
import type { PlayerRow } from "@/lib/player";
import { POSITION_GROUPS, POSITION_LABELS, type Position } from "@/lib/player";
import type { WindowResult } from "@/lib/career/window";
import { PixelCrest } from "./PixelCrest";
import { FormChips } from "./FormChips";

const PINSTRIPES =
  "repeating-linear-gradient(115deg, transparent 0 22px, rgba(255,255,255,.014) 22px 23px)";

export function PlayerCard({
  player,
  appearances,
  impactRating,
  form,
  nextBadge,
  totalPoints = null,
  averageMultiplier = null,
}: {
  player: PlayerRow;
  appearances: number;
  impactRating: number | null;
  form: WindowResult[];
  nextBadge: { name: string; hint: string } | null;
  // Derived client-side from the matchday results map; the banner's mini
  // stats at desktop width.
  totalPoints?: number | null;
  averageMultiplier?: number | null;
}) {
  // Progress is only claimed where the data actually counts something.
  const progress =
    nextBadge?.name === "Ever Present"
      ? Math.min(1, appearances / 5)
      : nextBadge?.name === "First Whistle"
        ? 0
        : null;

  const nextBadgePanel = nextBadge && (
    <div className="relative rounded-[11px] border border-white/[0.06] bg-pitch-900 px-[11px] py-2.5">
      <div className="flex items-center justify-between">
        <span className="font-label text-[9px] font-semibold uppercase tracking-[0.16em] text-chalk-500">
          Next badge
        </span>
        <span className="hero-number text-[11px] uppercase tracking-[0.06em] text-chalk-300">
          {nextBadge.name}
        </span>
      </div>
      {progress !== null && (
        <div className="mt-2 h-[5px] overflow-hidden rounded-[3px] bg-[#1c1c22]">
          <div
            className="h-full rounded-[3px] bg-volt shadow-[0_0_10px_rgba(200,255,0,.6)]"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}
      <p className="mt-1.5 font-label text-[8px] font-semibold uppercase tracking-[0.14em] text-chalk-600">
        {nextBadge.hint}
      </p>
    </div>
  );

  const identity = (size: number) => (
    <div className="relative flex items-center gap-[13px]">
      <PixelCrest
        seed={`${player.name}-${player.shirt_number}`}
        number={player.shirt_number}
        size={size}
        className="shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className="font-label text-[9px] font-semibold uppercase tracking-[0.16em] text-chalk-600">
          Contracted · World Cup 2026
        </p>
        <p className="mt-1 flex items-baseline gap-[7px]">
          <span className="hero-number truncate text-[28px] uppercase leading-none text-chalk-50 lg:text-[38px]">
            {player.name}
          </span>
          <span className="hero-number shrink-0 text-lg font-semibold leading-none text-chalk-500 lg:text-2xl">
            #{player.shirt_number}
          </span>
        </p>
        <p
          className="mt-1 font-label text-[9px] font-semibold uppercase tracking-[0.14em] text-chalk-400"
          title={POSITION_LABELS[player.position as Position]}
        >
          Super Sub · {POSITION_GROUPS[player.position as Position]}
        </p>
      </div>
    </div>
  );

  return (
    <Link
      href="/career"
      aria-label={`${player.name}, open the career page`}
      className="panel panel-hover relative block overflow-hidden !bg-gradient-to-b !from-pitch-800 !to-[#0d0d10] p-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50 lg:p-0"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: PINSTRIPES }} />

      {/* Desktop: the full-width banner (identity | impact | stats + badge) */}
      <div className="relative hidden lg:flex lg:items-stretch">
        <div className="flex flex-none items-center px-[22px] py-[18px]">
          {identity(88)}
        </div>
        <div className="flex flex-1 items-center justify-center border-x border-white/[0.07] p-[18px]">
          <div className="text-center">
            <p className="font-label text-[9px] font-semibold uppercase tracking-[0.2em] text-chalk-500">
              Impact rating
            </p>
            <p className="hero-number mt-1.5 text-[76px] leading-[0.82] tracking-[0.01em] text-volt [text-shadow:0_0_40px_rgba(200,255,0,.35)]">
              {impactRating === null ? "--" : Math.round(impactRating)}
            </p>
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="font-label text-[8px] font-semibold uppercase tracking-[0.16em] text-chalk-500">
                Form
              </span>
              <FormChips form={form} />
            </div>
          </div>
        </div>
        <div className="flex w-[230px] flex-none flex-col justify-center gap-3 px-5 py-[18px]">
          <div className="flex gap-4">
            <div>
              <p className="font-label text-[8px] font-semibold uppercase tracking-[0.14em] text-chalk-600">Apps</p>
              <p className="hero-number text-2xl leading-tight text-chalk-50">{appearances}</p>
            </div>
            <div>
              <p className="font-label text-[8px] font-semibold uppercase tracking-[0.14em] text-chalk-600">Career pts</p>
              <p className="hero-number text-2xl leading-tight text-chalk-50">
                {totalPoints === null ? "--" : Math.round(totalPoints)}
              </p>
            </div>
            <div>
              <p className="font-label text-[8px] font-semibold uppercase tracking-[0.14em] text-chalk-600">Avg</p>
              <p className="hero-number text-2xl leading-tight text-chalk-50">
                {averageMultiplier === null ? "--" : `${averageMultiplier.toFixed(1)}x`}
              </p>
            </div>
          </div>
          {nextBadgePanel}
        </div>
      </div>

      {/* Mobile: the stacked kit card */}
      <div className="relative lg:hidden">
      {identity(62)}

      <div className="relative mt-3.5 flex items-end justify-between border-t border-white/[0.07] pt-[13px]">
        <div>
          <p className="font-label text-[9px] font-semibold uppercase tracking-[0.16em] text-chalk-500">
            Impact rating
          </p>
          <p className="hero-number mt-1 text-[54px] leading-[0.86] tracking-[0.01em] text-volt">
            {impactRating === null ? "--" : Math.round(impactRating)}
          </p>
        </div>
        <div className="pb-1 text-right">
          <p className="font-label text-[10px] font-bold tracking-[0.06em] text-chalk-300">
            {appearances} APP{appearances === 1 ? "" : "S"}
          </p>
          <p className="mt-1 font-label text-[8px] font-semibold leading-[1.3] tracking-[0.12em] text-chalk-600">
            THIS
            <br />
            TOURNAMENT
          </p>
        </div>
      </div>

      <div className="relative mt-[13px] flex items-center gap-2">
        <span className="font-label text-[9px] font-semibold uppercase tracking-[0.16em] text-chalk-500">
          Form
        </span>
        <FormChips form={form} />
      </div>

      {nextBadge && <div className="mt-[13px]">{nextBadgePanel}</div>}
      </div>
    </Link>
  );
}
