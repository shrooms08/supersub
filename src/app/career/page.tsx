"use client";

// The Career page, per the binding reference: the squad-profile eyebrow,
// the pinstriped hero (crest and identity left, the Impact Rating at
// 72/96px volt with the rank line centre, APPS / POINTS / AVG / BEST
// stats), the badge cabinet as roundel cards (earned glowBreath, locked
// at 0.32 opacity), and the match history as column rows with the tier
// tag ladder. Rank comes from the existing read-only matchday endpoint;
// BEST is derived client-side from the history. All data real.

import { useEffect, useState } from "react";
import Link from "next/link";
import { PixelCrest } from "@/components/PixelCrest";
import { FormChips } from "@/components/FormChips";
import { fmtMultiplier, fmtPoints } from "@/lib/format";
import { tierForMultiplier } from "@/lib/config/scoring";
import { POSITION_GROUPS, POSITION_LABELS, type PlayerRow, type Position } from "@/lib/player";
import { windowResult, type WindowResult } from "@/lib/career/window";
import type { CareerRecord } from "@/lib/career/stats";
import type { EntryRow } from "@/lib/entry";
import type { MatchdayPayload } from "@/app/api/matchday/route";

interface BadgeState {
  key: string;
  name: string;
  description: string;
  earnedAt: string | null;
}

interface CareerPayload {
  player: PlayerRow | null;
  record: CareerRecord;
  badges: BadgeState[];
  history: EntryRow[];
}

// Cabinet glyphs, one per badge, from the reference's glyph set.
const BADGE_GLYPHS: Record<string, string> = {
  first_whistle: "★",
  miracle_worker: "✦",
  iron_nerve: "◷",
  ever_present: "⬡",
  comeback_king: "◈",
  wounded: "✚",
};

// Tier tag ladder per the reference history rows: the top tier is
// volt-tinted, the next is a light chip, the rest outlined gray.
function TierTag({ multiplier }: { multiplier: number }) {
  const tier = tierForMultiplier(multiplier).name;
  const look =
    tier === "Miracle Territory"
      ? { background: "rgba(200,255,0,.14)", color: "#c8ff00", border: "1px solid rgba(200,255,0,.4)" }
      : tier === "The Gamble"
        ? { background: "#26262c", color: "#e4e4e7", border: "1px solid transparent" }
        : { background: "transparent", color: "#71717a", border: "1px solid rgba(255,255,255,.12)" };
  return (
    <span
      className="shrink-0 rounded-[5px] px-2 py-[5px] font-label text-[7px] font-bold uppercase tracking-[0.12em] lg:rounded-md lg:px-2.5 lg:py-1.5 lg:text-[8px] lg:tracking-[0.16em]"
      style={look}
    >
      {tier}
    </span>
  );
}

const WDL_CHIP: Record<WindowResult, { bg: string; col: string; bd: string }> = {
  W: { bg: "#e4e4e7", col: "#0a0a0c", bd: "transparent" },
  D: { bg: "#26262c", col: "#d4d4d8", bd: "transparent" },
  L: { bg: "transparent", col: "#52525b", bd: "#3a3a42" },
};

const PINSTRIPES =
  "repeating-linear-gradient(115deg, transparent 0 24px, rgba(255,255,255,.013) 24px 25px)";

export default function CareerPage() {
  const [data, setData] = useState<CareerPayload | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [status, setStatus] = useState<"loading" | "none" | "ready">("loading");

  const load = async () => {
    const res = await fetch("/api/career", { cache: "no-store" });
    if (res.status === 401) {
      setStatus("none");
      return;
    }
    const body = (await res.json()) as CareerPayload;
    setData(body);
    setStatus("ready");
    // Rank from the existing matchday endpoint (read-only, best effort).
    fetch("/api/matchday", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<MatchdayPayload>) : null))
      .then((m) => {
        const you = m?.table.find((row) => row.isYou);
        if (you) setRank(you.rank);
      })
      .catch(() => {});
  };

  useEffect(() => {
    void load();
  }, []);

  if (status === "loading") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-4 px-4 py-8 lg:max-w-5xl">
        <div className="panel-quiet h-40 animate-pulse" />
        <div className="panel-quiet h-32 animate-pulse" />
        <div className="panel-quiet h-48 animate-pulse" />
      </main>
    );
  }

  if (status === "none" || !data?.player) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center gap-4 px-4 py-8 text-center">
        <p className="hero-number text-2xl uppercase tracking-tight text-chalk-50">
          Nobody on the books
        </p>
        <p className="font-label text-sm text-chalk-400">Sign your contract on the bench first.</p>
        <Link
          href="/"
          className="min-h-[44px] rounded-md border border-chalk-600 px-4 py-2.5 font-label text-sm font-bold uppercase tracking-wide text-chalk-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50"
        >
          To the bench
        </Link>
      </main>
    );
  }

  const { player, record, badges, history } = data;
  const earnedCount = badges.filter((b) => b.earnedAt !== null).length;
  const bestMultiplier = history.length
    ? Math.max(...history.map((h) => h.multiplier))
    : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-4 px-4 py-6 lg:max-w-5xl">
      <header className="flex items-center justify-between gap-2">
        <p className="font-label text-[9px] font-bold uppercase tracking-[0.22em] text-volt lg:text-[10px] lg:tracking-[0.24em]">
          The career · Squad profile
        </p>
        <Link
          href="/"
          className="whisper rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50"
        >
          &lsaquo; The bench
        </Link>
      </header>

      {/* Hero */}
      <section
        aria-label="Player"
        className="panel relative overflow-hidden !rounded-2xl !bg-gradient-to-br !from-pitch-800 !to-[#0c0c0f] lg:flex lg:items-stretch lg:!p-0"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: PINSTRIPES }} />

        <div className="relative flex items-center gap-[13px] p-4 lg:flex-none lg:gap-[18px] lg:px-6 lg:py-[22px]">
          <PixelCrest
            seed={`${player.name}-${player.shirt_number}`}
            number={player.shirt_number}
            size={72}
            className="shrink-0 lg:hidden"
          />
          <PixelCrest
            seed={`${player.name}-${player.shirt_number}`}
            number={player.shirt_number}
            size={108}
            className="hidden shrink-0 lg:block"
          />
          <div className="min-w-0">
            <p className="font-label text-[9px] font-semibold uppercase tracking-[0.18em] text-chalk-600">
              Contracted · World Cup 2026
            </p>
            <p className="mt-1.5 flex items-baseline gap-2">
              <span className="hero-number truncate text-[30px] uppercase leading-none text-chalk-50 lg:text-[46px]">
                {player.name}
              </span>
              <span className="hero-number shrink-0 text-lg font-semibold leading-none text-chalk-500 lg:text-[28px]">
                #{player.shirt_number}
              </span>
            </p>
            <p
              className="mt-1.5 font-label text-[9px] font-semibold uppercase tracking-[0.16em] text-chalk-400"
              title={POSITION_LABELS[player.position as Position]}
            >
              Super Sub · {POSITION_GROUPS[player.position as Position]}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className="font-label text-[8px] font-semibold uppercase tracking-[0.16em] text-chalk-500">
                Form
              </span>
              <FormChips form={record.form} />
            </div>
          </div>
        </div>

        <div className="relative border-t border-white/[0.07] p-5 text-center lg:flex lg:flex-1 lg:flex-col lg:items-center lg:justify-center lg:border-l lg:border-t-0">
          <p className="font-label text-[9px] font-semibold uppercase tracking-[0.2em] text-chalk-500">
            Impact rating
          </p>
          <p className="hero-number mt-1 text-[72px] leading-[0.82] text-volt [text-shadow:0_0_34px_rgba(200,255,0,.4)] lg:text-[96px] lg:[text-shadow:0_0_44px_rgba(200,255,0,.4)]">
            {record.impactRating === null ? "--" : Math.round(record.impactRating)}
          </p>
          {rank !== null && (
            <p className="mt-1.5 font-label text-[8px] font-bold uppercase tracking-[0.14em] text-chalk-300 lg:text-[9px]">
              Rank {rank} on the table
            </p>
          )}
        </div>

        <div className="relative grid grid-cols-4 border-t border-white/[0.07] lg:w-[186px] lg:flex-none lg:grid-cols-2 lg:grid-rows-2 lg:border-l lg:border-t-0">
          {[
            ["Apps", String(record.appearances), false],
            ["Points", fmtPoints(record.totalPoints), false],
            [
              "Avg mult",
              record.averageMultiplier === null ? "--" : fmtMultiplier(record.averageMultiplier),
              false,
            ],
            ["Best", bestMultiplier === null ? "--" : fmtMultiplier(bestMultiplier), true],
          ].map(([label, value, volt]) => (
            <div
              key={label as string}
              className="border-r border-white/[0.07] p-2.5 text-center last:border-r-0 lg:border-b lg:p-4 lg:text-left lg:[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(n+3)]:border-b-0"
            >
              <p className="font-label text-[7px] font-semibold uppercase tracking-[0.14em] text-chalk-600 lg:text-[8px]">
                {label}
              </p>
              <p
                className={`hero-number mt-0.5 text-xl leading-tight lg:text-[30px] ${
                  volt ? "text-volt" : "text-chalk-50"
                }`}
              >
                {value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Badge cabinet */}
      <section aria-label="Honours board">
        <h2 className="font-label text-[9px] font-bold uppercase tracking-[0.16em] text-chalk-500 lg:text-[10px] lg:tracking-[0.18em]">
          Badge cabinet · {earnedCount} of {badges.length}
        </h2>
        <ul className="mt-2 grid grid-cols-3 gap-2 lg:grid-cols-6 lg:gap-[11px]">
          {badges.map((badge) => {
            const earned = badge.earnedAt !== null;
            return (
              <li
                key={badge.key}
                className={`rounded-[11px] px-2 py-[11px] text-center lg:rounded-[13px] lg:px-3 lg:py-4 ${
                  earned ? "animate-glow-breath-slow" : ""
                }`}
                style={{
                  background: earned
                    ? "linear-gradient(180deg, rgba(200,255,0,.1), rgba(200,255,0,.02))"
                    : "#0c0c0f",
                  border: `1px solid ${earned ? "rgba(200,255,0,.4)" : "rgba(255,255,255,.07)"}`,
                  opacity: earned ? 1 : 0.32,
                }}
                title={badge.description}
              >
                <div
                  aria-hidden
                  className="hero-number mx-auto grid h-9 w-9 place-items-center rounded-full text-[17px] lg:h-[46px] lg:w-[46px] lg:text-[22px]"
                  style={{
                    background: earned ? "#c8ff00" : "#1c1c22",
                    color: earned ? "#0a0a0c" : "#52525b",
                    boxShadow: earned ? "0 0 20px rgba(200,255,0,.5)" : "none",
                  }}
                >
                  {BADGE_GLYPHS[badge.key] ?? "★"}
                </div>
                <p className="hero-number mt-2 text-xs uppercase leading-none text-chalk-50 lg:text-base">
                  {badge.name}
                </p>
                <p className="mt-1.5 hidden font-label text-[8px] leading-[1.3] text-chalk-400 lg:block">
                  {badge.description}
                </p>
                <p
                  className="mt-1.5 font-label text-[6px] font-bold uppercase tracking-[0.14em] lg:text-[7px] lg:tracking-[0.16em]"
                  style={{ color: earned ? "#c8ff00" : "#52525b" }}
                >
                  {earned ? "Earned" : "Locked"}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Match history */}
      <section aria-label="Match history">
        <h2 className="font-label text-[9px] font-bold uppercase tracking-[0.16em] text-chalk-500 lg:text-[10px] lg:tracking-[0.18em]">
          Match history · Tap for report
        </h2>
        {history.length === 0 ? (
          <div className="panel-quiet mt-2 !rounded-[14px] px-4 py-6 text-center">
            <p className="hero-number text-sm uppercase tracking-wide text-chalk-300">
              The book is open at page one
            </p>
            <p className="mt-1.5 font-label text-sm text-chalk-400">No appearances written yet.</p>
            <p className="whisper mt-1">Get off the bench; the Gazette is waiting.</p>
          </div>
        ) : (
          <ul className="mt-2 overflow-hidden rounded-[14px] border border-white/[0.07] bg-[#0b0b0e]">
            {history.map((entry) => {
              const wdl = windowResult(entry.breakdown);
              return (
                <li key={entry.id} className="border-b border-white/5 last:border-b-0">
                  <Link
                    href={`/career/${entry.id}`}
                    className="flex items-center gap-2.5 px-3 py-[11px] transition-colors hover:bg-pitch-850 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50 lg:gap-4 lg:px-4 lg:py-[13px]"
                  >
                    <span
                      className="grid h-5 w-5 flex-none place-items-center rounded-[5px] font-label text-[10px] font-bold lg:h-[22px] lg:w-[22px] lg:text-[11px]"
                      style={{
                        background: WDL_CHIP[wdl].bg,
                        color: WDL_CHIP[wdl].col,
                        border: `1px solid ${WDL_CHIP[wdl].bd}`,
                      }}
                    >
                      {wdl}
                    </span>
                    <span className="min-w-0 flex-1 lg:w-[180px] lg:flex-none">
                      <span className="hero-number block truncate text-[15px] uppercase leading-none text-chalk-50 lg:text-lg">
                        {entry.team_name} {entry.final_score_team}&ndash;{entry.final_score_opp}{" "}
                        {entry.opponent_name}
                      </span>
                      <span className="mt-1 block font-label text-[7px] font-semibold uppercase tracking-[0.1em] text-chalk-600 lg:text-[8px] lg:tracking-[0.12em]">
                        On {entry.entry_minute}&apos; · {fmtMultiplier(entry.multiplier)}
                      </span>
                    </span>
                    <span className="hidden lg:block lg:w-24 lg:flex-none">
                      <span className="block font-label text-[8px] font-semibold uppercase tracking-[0.12em] text-chalk-600">
                        Entered
                      </span>
                      <span className="hero-number text-[17px] text-chalk-100">
                        {entry.entry_minute}&apos;
                      </span>
                    </span>
                    <span className="hidden lg:block lg:w-[88px] lg:flex-none">
                      <span className="block font-label text-[8px] font-semibold uppercase tracking-[0.12em] text-chalk-600">
                        Mult
                      </span>
                      <span className="hero-number text-[17px] text-chalk-400">
                        {fmtMultiplier(entry.multiplier)}
                      </span>
                    </span>
                    <span className="hidden flex-1 lg:block" />
                    <TierTag multiplier={entry.multiplier} />
                    <span className="hero-number w-[52px] shrink-0 text-right text-lg text-chalk-50 lg:w-[76px] lg:text-[22px]">
                      {fmtPoints(entry.final_points ?? 0)}
                    </span>
                    <span aria-hidden className="text-base text-chalk-600">
                      &rsaquo;
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
