"use client";

// Running event ticker: goals, cards, corners, penalties, VAR, the
// whistles, each with its own glyph. Newest first, each new arrival
// pulses once. A VAR-erased action stays in the list, struck through,
// wearing its overturn.

import type { Fixture } from "@/lib/feed/types";
import type { TickerItem } from "@/lib/state/fold";
import { ACTION_LABELS } from "@/lib/format";

const MAX_ITEMS = 30;

function teamName(fixture: Fixture, participant?: number): string | null {
  if (participant === 1) return fixture.participant1;
  if (participant === 2) return fixture.participant2;
  return null;
}

// One glyph per event family. Grayscale except the cards, which keep
// their real-world colors, desaturated.
function EventGlyph({ action, dim }: { action: string; dim: boolean }) {
  const stroke = dim ? "#6e6e68" : "#b3b3ad";
  const strong = dim ? "#6e6e68" : "#e8e8e4";
  const box = "flex h-4 w-4 shrink-0 items-center justify-center";

  switch (action) {
    case "goal":
      return (
        <span aria-hidden className={box}>
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5">
            <circle cx="8" cy="8" r="6" fill={strong} />
            <circle cx="8" cy="8" r="6" fill="none" stroke={stroke} strokeWidth="1.5" />
            <path d="M8 5.2 L10.6 7.1 L9.6 10.2 L6.4 10.2 L5.4 7.1 Z" fill="#141418" />
          </svg>
        </span>
      );
    case "corner":
      return (
        <span aria-hidden className={box}>
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5">
            <line x1="4" y1="2" x2="4" y2="14" stroke={stroke} strokeWidth="1.5" />
            <path d="M4 2 L12 4.5 L4 7 Z" fill={strong} />
          </svg>
        </span>
      );
    case "yellow_card":
      return (
        <span aria-hidden className={box}>
          <span className="h-3.5 w-2.5 rounded-[1px] bg-card-yellow/80" />
        </span>
      );
    case "red_card":
      return (
        <span aria-hidden className={box}>
          <span className="h-3.5 w-2.5 rounded-[1px] bg-card-red/80" />
        </span>
      );
    case "penalty":
    case "penalty_outcome":
      return (
        <span aria-hidden className={box}>
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5">
            <circle cx="8" cy="8" r="6" fill="none" stroke={stroke} strokeWidth="1.5" />
            <circle cx="8" cy="8" r="1.8" fill={strong} />
          </svg>
        </span>
      );
    case "substitution":
      return (
        <span aria-hidden className={box}>
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5">
            <path d="M3 6 L9 6 M9 6 L7 4 M9 6 L7 8" stroke={strong} strokeWidth="1.5" fill="none" />
            <path d="M13 10 L7 10 M7 10 L9 8 M7 10 L9 12" stroke={stroke} strokeWidth="1.5" fill="none" />
          </svg>
        </span>
      );
    case "var":
    case "var_end":
      return (
        <span
          aria-hidden
          className="flex h-4 shrink-0 items-center rounded-[2px] border border-chalk-600 px-0.5 text-[7px] font-black tracking-wide text-chalk-300"
        >
          VAR
        </span>
      );
    case "kickoff":
      return <WhistleChip label="KO" dim={dim} />;
    case "halftime_finalised":
      return <WhistleChip label="HT" dim={dim} />;
    case "game_finalised":
      return <WhistleChip label="FT" dim={dim} />;
    case "additional_time":
      return <WhistleChip label="+" dim={dim} />;
    default:
      return (
        <span aria-hidden className={box}>
          <span className="h-1.5 w-1.5 rounded-full bg-chalk-500" />
        </span>
      );
  }
}

function WhistleChip({ label, dim }: { label: string; dim: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[2px] text-[8px] font-black ${
        dim ? "bg-pitch-700 text-chalk-500" : "bg-pitch-600 text-chalk-100"
      }`}
    >
      {label}
    </span>
  );
}

export function EventTicker({
  items,
  fixture,
}: {
  items: TickerItem[];
  fixture: Fixture;
}) {
  const shown = [...items].reverse().slice(0, MAX_ITEMS);

  return (
    <section aria-label="Match events" className="panel-quiet overflow-hidden">
      <div className="flex items-baseline justify-between border-b border-pitch-700 px-4 py-2">
        <h2 className="label">As it happened</h2>
        <p className="whisper">{shown.length > 0 ? `Last ${shown.length}` : "Waiting"}</p>
      </div>
      {shown.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="font-display text-sm font-black uppercase tracking-wide text-chalk-300">
            The tunnel is quiet
          </p>
          <p className="mt-1.5 text-xs text-chalk-500">
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
            return (
              <li
                key={`${item.id}:${item.action}`}
                className="flex items-center gap-3 px-4 py-2 animate-pulse-once"
              >
                <span className="w-8 shrink-0 text-right font-display text-xs font-black tabular-nums text-chalk-400">
                  {item.minute !== null ? `${item.minute}'` : ""}
                </span>
                <EventGlyph action={item.action} dim={item.discarded} />
                <span className="flex min-w-0 flex-1 items-baseline gap-2">
                  <span
                    className={
                      item.discarded
                        ? "text-sm font-semibold text-chalk-500 line-through"
                        : isGoal
                          ? "display-condensed font-display text-sm font-black uppercase tracking-wide text-chalk-50"
                          : "text-sm font-semibold text-chalk-200"
                    }
                  >
                    {label}
                    {item.detail ? ` (${item.detail})` : ""}
                  </span>
                  {team && <span className="truncate text-xs text-chalk-500">{team}</span>}
                  {item.discarded && (
                    <span className="shrink-0 rounded-sm bg-pitch-700 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-chalk-300">
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
