"use client";

// The Career page: a squad profile, not a productivity app. Hero identity
// with one hero number (Impact Rating), the record, the badge cabinet,
// and the match history.

import { useEffect, useState } from "react";
import Link from "next/link";
import { PixelCrest } from "@/components/PixelCrest";
import { fmtMultiplier, fmtPoints } from "@/lib/format";
import { tierForMultiplier } from "@/lib/config/scoring";
import { POSITION_LABELS, type PlayerRow, type Position } from "@/lib/player";
import { FormChips } from "@/components/FormChips";
import { KitShirt } from "@/components/KitShirt";
import type { CareerRecord } from "@/lib/career/stats";
import type { EntryRow } from "@/lib/entry";

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

// Multiplier tier as a tag. Grayscale ladder by boldness of the take;
// Miracle Territory alone earns the dimmed volt, as close to a hero
// number as a chip gets.
function TierTag({ multiplier }: { multiplier: number }) {
  const tier = tierForMultiplier(multiplier).name;
  const look =
    tier === "Miracle Territory"
      ? "border-volt/50 text-volt"
      : tier === "The Gamble"
        ? "border-chalk-400 text-chalk-100"
        : tier === "Squad Rotation"
          ? "border-chalk-600 text-chalk-300"
          : "border-pitch-500 text-chalk-500";
  return (
    <span
      className={`rounded-sm border px-1.5 py-0.5 font-label text-[9px] font-bold uppercase tracking-[0.16em] ${look}`}
    >
      {tier} {fmtMultiplier(multiplier)}
    </span>
  );
}

export default function CareerPage() {
  const [data, setData] = useState<CareerPayload | null>(null);
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
  };

  useEffect(() => {
    void load();
  }, []);

  if (status === "loading") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-4 px-4 py-8">
        <div className="h-32 animate-pulse rounded-lg border border-pitch-700 bg-pitch-850" />
        <div className="h-24 animate-pulse rounded-lg border border-pitch-700 bg-pitch-850" />
        <div className="h-48 animate-pulse rounded-lg border border-pitch-700 bg-pitch-850" />
      </main>
    );
  }

  if (status === "none" || !data?.player) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center gap-4 px-4 py-8 text-center">
        <p className="font-display text-2xl font-black uppercase tracking-tight text-chalk-50">
          Nobody on the books
        </p>
        <p className="text-sm text-chalk-400">Sign your forms on the bench first.</p>
        <Link
          href="/"
          className="min-h-[44px] rounded-md border border-chalk-600 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-chalk-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50"
        >
          To the bench
        </Link>
      </main>
    );
  }

  const { player, record, badges, history } = data;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 px-4 py-8 lg:max-w-3xl">
      <header className="flex items-center justify-between gap-2">
        <Link
          href="/"
          className="whisper rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50"
        >
          &lsaquo; The bench
        </Link>
      </header>

      {/* Hero: identity + Impact Rating */}
      <section aria-label="Player" className="panel overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-pitch-700 px-5 py-2">
          <span className="label">Squad profile</span>
          <PixelCrest seed={`${player.name}-${player.shirt_number}`} number={player.shirt_number} size={22} />
        </div>
        <div className="flex items-center justify-between gap-4 p-5">
          <div className="flex min-w-0 items-center gap-4">
            <KitShirt name={player.name} shirtNumber={player.shirt_number} size={80} className="shrink-0" />
            <div className="min-w-0">
              <h1 className="truncate font-display text-2xl font-black uppercase leading-none tracking-tight text-chalk-50 sm:text-3xl">
                {player.name}
              </h1>
              <p className="mt-1 text-sm text-chalk-400">
                No. {player.shirt_number} · {POSITION_LABELS[player.position as Position]}
              </p>
              <p className="whisper mt-0.5 hidden sm:block">Contracted for the tournament</p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="hero-number text-[64px] leading-[0.86] text-volt sm:text-[96px]">
              {record.impactRating === null ? "--" : Math.round(record.impactRating)}
            </p>
            <p className="whisper mt-1">Impact rating</p>
          </div>
        </div>
      </section>

      {/* The record */}
      <section aria-label="The record" className="panel-quiet overflow-hidden">
        <h2 className="label border-b border-pitch-700 px-4 py-2">The record</h2>
        <div className="grid grid-cols-2 gap-px bg-pitch-800 sm:grid-cols-4">
          {[
            { label: "Appearances", value: String(record.appearances) },
            { label: "Total points", value: fmtPoints(record.totalPoints) },
            {
              label: "Avg multiplier",
              value: record.averageMultiplier === null ? "--" : fmtMultiplier(record.averageMultiplier),
            },
            { label: "Legendary", value: String(record.legendaryCount) },
          ].map((stat) => (
            <div key={stat.label} className="bg-pitch-900 px-4 py-3">
              <p className="hero-number text-[30px] font-semibold leading-none text-chalk-50">
                {stat.value}
              </p>
              <p className="whisper mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-pitch-700 px-4 py-3">
          <p className="whisper">Current form</p>
          <FormChips form={record.form} />
        </div>
      </section>

      {/* Badge cabinet */}
      <section aria-label="Honours board" className="panel-quiet overflow-hidden">
        <h2 className="label border-b border-pitch-700 px-4 py-2">The cabinet</h2>
        <ul className="grid grid-cols-2 gap-px bg-pitch-800 sm:grid-cols-3">
          {badges.map((badge) => {
            const earned = badge.earnedAt !== null;
            return (
              <li
                key={badge.key}
                className={`flex flex-col gap-1 px-4 py-3 ${
                  earned
                    ? "animate-glow-breath-slow bg-pitch-850 shadow-[inset_0_0_0_1px_rgba(200,255,0,0.4)]"
                    : "bg-pitch-900 opacity-[0.22] shadow-[inset_0_0_0_1px_rgba(58,58,66,0.6)]"
                }`}
              >
                <p
                  className={`hero-number text-sm uppercase tracking-wide ${
                    earned ? "text-chalk-50" : "text-chalk-600"
                  }`}
                >
                  {earned ? badge.name : "Locked"}
                </p>
                <p className={`text-xs leading-snug ${earned ? "text-chalk-400" : "text-chalk-600"}`}>
                  {earned ? badge.description : badge.name}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Match history */}
      <section aria-label="Match history" className="panel-quiet overflow-hidden">
        <h2 className="label border-b border-pitch-700 px-4 py-2">As it was written</h2>
        {history.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="font-display text-sm font-black uppercase tracking-wide text-chalk-300">
              The book is open at page one
            </p>
            <p className="mt-1.5 text-sm text-chalk-400">No appearances written yet.</p>
            <p className="whisper mt-1">Get off the bench; the Gazette is waiting.</p>
          </div>
        ) : (
          <ul className="divide-y divide-pitch-800">
            {history.map((entry) => (
              <li key={entry.id}>
                <Link
                  href={`/career/${entry.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-pitch-850 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-chalk-100">
                      {entry.team_name} {entry.final_score_team} - {entry.final_score_opp}{" "}
                      {entry.opponent_name}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5">
                      <span className="whisper">On {entry.entry_minute}&apos;</span>
                      <TierTag multiplier={entry.multiplier} />
                    </p>
                  </div>
                  <p className="hero-number shrink-0 text-xl text-chalk-50">
                    {fmtPoints(entry.final_points ?? 0)}
                    <span aria-hidden className="ml-2 font-normal text-chalk-600">&rsaquo;</span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
