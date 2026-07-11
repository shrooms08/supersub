"use client";

// The kit card: who you are on matchday. Crest, kit, name and number,
// position, Impact Rating as the hero number, form, and the next locked
// badge teased. Links to the full squad profile.

import Link from "next/link";
import type { PlayerRow } from "@/lib/player";
import { POSITION_LABELS, type Position } from "@/lib/player";
import type { WindowResult } from "@/lib/career/window";
import { KitShirt } from "./KitShirt";
import { PlayerAvatar } from "./PlayerAvatar";
import { FormChips } from "./FormChips";

export function PlayerCard({
  player,
  appearances,
  impactRating,
  form,
  nextBadge,
}: {
  player: PlayerRow;
  appearances: number;
  impactRating: number | null;
  form: WindowResult[];
  nextBadge: { name: string; hint: string } | null;
}) {
  return (
    <Link
      href="/career"
      aria-label={`${player.name}, open the career page`}
      className="panel panel-hover block overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt"
    >
      <div className="flex items-center justify-between gap-2 border-b border-pitch-700 px-4 py-2">
        <span className="label">On the bench tonight</span>
        <PlayerAvatar name={player.name} shirtNumber={player.shirt_number} size={22} />
      </div>

      <div className="flex items-center gap-4 px-4 pb-3 pt-4">
        <KitShirt name={player.name} shirtNumber={player.shirt_number} size={84} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="display-condensed truncate font-display text-2xl font-black uppercase leading-none tracking-tight text-chalk-50">
            {player.name}
          </p>
          <p className="mt-1 text-xs text-chalk-400">
            No. {player.shirt_number} · {POSITION_LABELS[player.position as Position]}
          </p>
          <p className="mt-0.5 text-xs text-chalk-500">
            {appearances === 0
              ? "Yet to make an appearance"
              : `${appearances} appearance${appearances === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="hero-number text-5xl leading-none text-volt">
            {impactRating === null ? "--" : Math.round(impactRating)}
          </p>
          <p className="whisper mt-1">Impact</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-pitch-700 px-4 py-2.5">
        <span className="label">Form</span>
        <FormChips form={form} size={6} />
      </div>

      {nextBadge && (
        <div className="flex items-baseline justify-between gap-3 border-t border-pitch-700 bg-pitch-900/60 px-4 py-2.5">
          <span className="label">Next honour</span>
          <span className="truncate text-xs font-semibold text-chalk-300">
            {nextBadge.hint}
          </span>
        </div>
      )}
    </Link>
  );
}
