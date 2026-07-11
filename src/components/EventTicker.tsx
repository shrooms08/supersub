"use client";

// Running event ticker with the canonical chip treatments: GOAL is a
// light chip with a dark glyph, CARD is amber, CORNER neutral, VAR
// volt-tinted. Newest first; new arrivals wash in once. A goal that VAR
// erases plays ripBack (real feed events only: our TxLINE stream emits
// genuine var / var_end / action_discarded actions, so nothing here is
// simulated), then settles as a struck-through line wearing its overturn.

import { useEffect, useRef, useState } from "react";
import type { Fixture } from "@/lib/feed/types";
import type { TickerItem } from "@/lib/state/fold";
import { ACTION_LABELS } from "@/lib/format";

const MAX_ITEMS = 30;

function teamName(fixture: Fixture, participant?: number): string | null {
  if (participant === 1) return fixture.participant1;
  if (participant === 2) return fixture.participant2;
  return null;
}

// Chip spec per event family, from the reference file's event list.
function chipFor(action: string): { bg: string; col: string; glyph: string } {
  switch (action) {
    case "goal":
      return { bg: "#e4e4e7", col: "#0a0a0c", glyph: "●" };
    case "yellow_card":
      return { bg: "#3a3a20", col: "#e9e26a", glyph: "▮" };
    case "red_card":
      return { bg: "#3a1d1d", col: "#dc2626", glyph: "▮" };
    case "corner":
      return { bg: "#1c1c22", col: "#a1a1aa", glyph: "⚑" };
    case "var":
    case "var_end":
      return { bg: "rgba(200,255,0,.16)", col: "#c8ff00", glyph: "VAR" };
    case "penalty":
    case "penalty_outcome":
      return { bg: "#1c1c22", col: "#d4d4d8", glyph: "◎" };
    case "substitution":
      return { bg: "#1c1c22", col: "#a1a1aa", glyph: "⇄" };
    case "kickoff":
      return { bg: "#26262c", col: "#e4e4e7", glyph: "KO" };
    case "halftime_finalised":
      return { bg: "#26262c", col: "#e4e4e7", glyph: "HT" };
    case "game_finalised":
      return { bg: "#26262c", col: "#e4e4e7", glyph: "FT" };
    case "additional_time":
      return { bg: "#1c1c22", col: "#a1a1aa", glyph: "+" };
    default:
      return { bg: "#1c1c22", col: "#71717a", glyph: "·" };
  }
}

export interface SwingStats {
  peak: number;
  low: number;
  now: number;
  mult: string;
}

export function EventTicker({
  items,
  fixture,
  live,
  swing,
}: {
  items: TickerItem[];
  fixture: Fixture;
  live?: boolean;
  swing?: SwingStats | null;
}) {
  const shown = [...items].reverse().slice(0, MAX_ITEMS);

  // ripBack choreography for freshly overturned rows: when an item flips
  // to discarded, it rips away for .9s, then re-renders struck through.
  const knownDiscarded = useRef<Set<number> | null>(null);
  const [ripping, setRipping] = useState<Set<number>>(new Set());
  useEffect(() => {
    const discardedNow = new Set(items.filter((i) => i.discarded).map((i) => i.id));
    if (knownDiscarded.current === null) {
      // First fold after mount: backfilled overturns are history, not news.
      knownDiscarded.current = discardedNow;
      return;
    }
    const fresh = [...discardedNow].filter((id) => !knownDiscarded.current!.has(id));
    knownDiscarded.current = discardedNow;
    if (fresh.length > 0) {
      setRipping((prev) => new Set([...prev, ...fresh]));
    }
  }, [items]);

  return (
    <section aria-label="Match events" className="panel-quiet overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-[15px] py-[13px]">
        <h2 className="font-label text-[10px] font-bold uppercase tracking-[0.18em] text-chalk-500">
          Match ticker
        </h2>
        {live ? (
          <span className="flex items-center gap-[5px] font-label text-[8px] font-bold uppercase tracking-[0.16em] text-volt">
            <span aria-hidden className="h-[5px] w-[5px] rounded-full bg-volt animate-live-pulse" />
            Updating
          </span>
        ) : (
          <span className="font-label text-[8px] font-bold uppercase tracking-[0.16em] text-chalk-600">
            {shown.length > 0 ? `Last ${shown.length}` : "Waiting"}
          </span>
        )}
      </div>
      {shown.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="hero-number text-sm uppercase tracking-wide text-chalk-300">
            The tunnel is quiet
          </p>
          <p className="mt-1.5 font-label text-xs text-chalk-500">
            Nothing in the book yet. Studs on concrete, then the whistle.
          </p>
          <p className="whisper mt-1">Every touch lands here as it happens.</p>
        </div>
      ) : (
        <ul className="max-h-64 divide-y divide-pitch-800 overflow-y-auto">
          {shown.map((item) => {
            const label = ACTION_LABELS[item.action] ?? item.action.replace(/_/g, " ");
            const team = teamName(fixture, item.participant);
            const isGoal = item.action === "goal";
            const chip = chipFor(item.action);
            const isRipping = ripping.has(item.id) && item.discarded;
            return (
              <li
                key={`${item.id}:${item.action}`}
                onAnimationEnd={
                  isRipping
                    ? () =>
                        setRipping((prev) => {
                          const next = new Set(prev);
                          next.delete(item.id);
                          return next;
                        })
                    : undefined
                }
                className={`flex gap-[11px] px-[13px] py-[9px] ${
                  isRipping ? "animate-rip-back" : "animate-pulse-once"
                }`}
              >
                <span
                  aria-hidden
                  className="grid h-[26px] w-[26px] flex-none place-items-center rounded-[7px] font-label text-[11px] font-bold"
                  style={{ background: chip.bg, color: chip.col }}
                >
                  {chip.glyph}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="hero-number text-[13px] leading-none text-chalk-300">
                      {item.minute !== null ? `${item.minute}'` : "--"}
                    </span>
                    <span className="font-label text-[7px] font-bold uppercase tracking-[0.12em] text-chalk-500">
                      {item.action.replace(/_/g, " ")}
                    </span>
                    {team && (
                      <span className="truncate font-label text-[7px] font-bold uppercase tracking-[0.12em] text-chalk-600">
                        {team}
                      </span>
                    )}
                    {item.discarded && (
                      <span className="shrink-0 rounded-sm bg-pitch-700 px-1.5 py-0.5 font-label text-[8px] font-bold uppercase tracking-[0.14em] text-chalk-300">
                        {item.action === "goal" ? "VAR: overturned" : "Overturned"}
                      </span>
                    )}
                  </span>
                  <span
                    className={`mt-0.5 block font-label text-[10px] leading-[1.3] ${
                      item.discarded
                        ? "text-chalk-500 line-through"
                        : isGoal
                          ? "font-semibold text-chalk-100"
                          : "text-chalk-400"
                    }`}
                  >
                    {label}
                    {item.detail ? ` (${item.detail})` : ""}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {swing && (
        <div className="border-t border-white/[0.06] bg-pitch-900 px-[15px] py-3">
          <p className="mb-2 font-label text-[9px] font-bold uppercase tracking-[0.16em] text-chalk-500">
            Swing since kickoff
          </p>
          <div className="flex justify-between">
            {[
              ["Peak", `${Math.round(swing.peak * 100)}%`, "text-chalk-300"],
              ["Low", `${Math.round(swing.low * 100)}%`, "text-volt"],
              ["Now", `${Math.round(swing.now * 100)}%`, "text-chalk-300"],
              ["Mult", swing.mult, "text-volt"],
            ].map(([label2, value, col]) => (
              <div key={label2 as string}>
                <p className="font-label text-[8px] font-semibold uppercase tracking-[0.12em] text-chalk-600">
                  {label2}
                </p>
                <p className={`hero-number text-xl leading-tight ${col}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
