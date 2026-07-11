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

export function EventTicker({
  items,
  fixture,
}: {
  items: TickerItem[];
  fixture: Fixture;
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
      <div className="flex items-baseline justify-between border-b border-pitch-700 px-4 py-2">
        <h2 className="label">As it happened</h2>
        <p className="whisper">{shown.length > 0 ? `Last ${shown.length}` : "Waiting"}</p>
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
                className={`flex items-center gap-3 px-4 py-2 ${
                  isRipping ? "animate-rip-back" : "animate-pulse-once"
                }`}
              >
                <span className="w-7 shrink-0 text-right font-label text-[9px] font-bold tracking-[0.18em] text-chalk-400">
                  {item.minute !== null ? `${item.minute}'` : ""}
                </span>
                <span
                  aria-hidden
                  className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-[4px] px-1 font-label text-[9px] font-black"
                  style={{ background: chip.bg, color: chip.col }}
                >
                  {chip.glyph}
                </span>
                <span className="flex min-w-0 flex-1 items-baseline gap-2">
                  <span
                    className={
                      item.discarded
                        ? "font-label text-[13px] font-medium text-chalk-500 line-through"
                        : isGoal
                          ? "hero-number text-sm uppercase tracking-wide text-chalk-50"
                          : "font-label text-[13px] font-medium text-chalk-100"
                    }
                  >
                    {label}
                    {item.detail ? ` (${item.detail})` : ""}
                  </span>
                  {team && <span className="truncate font-label text-xs text-chalk-500">{team}</span>}
                  {item.discarded && (
                    <span className="shrink-0 rounded-sm bg-pitch-700 px-1.5 py-0.5 font-label text-[10px] font-bold uppercase tracking-widest text-chalk-300">
                      {item.action === "goal" ? "VAR: overturned" : "Overturned"}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
