"use client";

// Top-left of the bench: who you are and what your career says. Links to
// the full squad profile. Impact Rating is a hero number, so it gets volt.

import Link from "next/link";
import type { PlayerRow } from "@/lib/player";
import { PlayerAvatar } from "./PlayerAvatar";

export function PlayerChip({
  player,
  appearances,
  impactRating,
}: {
  player: PlayerRow;
  appearances: number;
  impactRating: number | null;
}) {
  return (
    <Link
      href="/career"
      className="flex items-center gap-3 rounded-lg border border-pitch-600 bg-pitch-850 px-3 py-2 transition-colors hover:border-chalk-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt"
      aria-label={`${player.name}, view career`}
    >
      <PlayerAvatar name={player.name} shirtNumber={player.shirt_number} size={40} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-bold text-chalk-50">
          {player.name}
          <span className="ml-1.5 font-normal text-chalk-500">#{player.shirt_number}</span>
        </span>
        <span className="whisper">
          {appearances === 0 ? "Yet to appear" : `${appearances} app${appearances === 1 ? "" : "s"}`}
        </span>
      </span>
      <span className="ml-1 flex flex-col items-end">
        <span className="hero-number text-2xl leading-none text-volt">
          {impactRating === null ? "--" : Math.round(impactRating)}
        </span>
        <span className="whisper">Impact</span>
      </span>
    </Link>
  );
}
