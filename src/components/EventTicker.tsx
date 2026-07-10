"use client";

// Running event ticker: goals, cards, corners, penalties, VAR, the
// whistles. Newest first, each new arrival pulses once. A VAR-erased
// action stays in the list, struck through, wearing its overturn.

import type { Fixture } from "@/lib/feed/types";
import type { TickerItem } from "@/lib/state/fold";
import { ACTION_LABELS } from "@/lib/format";

const MAX_ITEMS = 30;

function teamName(fixture: Fixture, participant?: number): string | null {
  if (participant === 1) return fixture.participant1;
  if (participant === 2) return fixture.participant2;
  return null;
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
    <section aria-label="Match events" className="rounded-lg border border-pitch-700 bg-pitch-900">
      <h2 className="whisper border-b border-pitch-700 px-4 py-2">As it happened</h2>
      {shown.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-chalk-500">
          Nothing in the book yet. The whistle is coming.
        </p>
      ) : (
        <ul className="max-h-64 divide-y divide-pitch-800 overflow-y-auto">
          {shown.map((item) => {
            const label = ACTION_LABELS[item.action] ?? item.action.replace(/_/g, " ");
            const team = teamName(fixture, item.participant);
            const isGoal = item.action === "goal";
            return (
              <li
                key={`${item.id}:${item.action}`}
                className="flex items-baseline gap-3 px-4 py-2 animate-pulse-once"
              >
                <span className="w-9 shrink-0 text-right text-xs font-bold tabular-nums text-chalk-400">
                  {item.minute !== null ? `${item.minute}'` : ""}
                </span>
                <span className="flex min-w-0 flex-1 items-baseline gap-2">
                  <span
                    className={
                      item.discarded
                        ? "text-sm font-semibold text-chalk-500 line-through"
                        : isGoal
                          ? "text-sm font-black uppercase tracking-wide text-chalk-50"
                          : "text-sm font-semibold text-chalk-200"
                    }
                  >
                    {item.action === "yellow_card" && (
                      <span
                        aria-hidden
                        className="mr-1.5 inline-block h-3 w-2.5 translate-y-px rounded-[1px] bg-card-yellow/80"
                      />
                    )}
                    {item.action === "red_card" && (
                      <span
                        aria-hidden
                        className="mr-1.5 inline-block h-3 w-2.5 translate-y-px rounded-[1px] bg-card-red/80"
                      />
                    )}
                    {label}
                    {item.detail ? ` (${item.detail})` : ""}
                  </span>
                  {team && (
                    <span className="truncate text-xs text-chalk-500">{team}</span>
                  )}
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
