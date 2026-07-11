// Legendary Entries: the three highest-multiplier winning entries across
// all players, styled as clipping teasers from the Gazette's back pages.

import type { LegendaryRow } from "@/app/api/matchday/route";
import { fmtMultiplier } from "@/lib/format";

export function LegendaryEntries({ rows }: { rows: LegendaryRow[] }) {
  return (
    <section aria-label="Legendary entries" className="panel-quiet overflow-hidden">
      <div className="flex items-baseline justify-between border-b border-pitch-700 px-4 py-2">
        <h2 className="label">Legendary entries</h2>
        <p className="whisper">All players, all time</p>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="font-display text-sm font-black uppercase tracking-wide text-chalk-300">
            The back page is blank
          </p>
          <p className="mt-1.5 text-xs text-chalk-500">
            No one has won a window from Miracle Territory yet.
          </p>
          <p className="whisper mt-1">The first 10x win writes itself here.</p>
        </div>
      ) : (
        <ul className="grid gap-px bg-pitch-800 sm:grid-cols-3">
          {rows.map((row, i) => (
            <li key={i} className="bg-pitch-900 px-4 py-3">
              <p className="hero-number text-3xl leading-none text-chalk-50">
                {fmtMultiplier(row.multiplier)}
              </p>
              <p className="whisper mt-1">{row.tierName}</p>
              <p className="mt-2 text-xs leading-snug text-chalk-300">
                <span className="font-bold text-chalk-100">
                  {row.playerName} ({row.shirtNumber})
                </span>{" "}
                entered the {row.entryMinute}th for {row.teamName}, won the window,
                took {Math.round(row.finalPoints)} points off {row.opponentName}.
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
