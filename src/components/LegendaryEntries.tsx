// Legendary Entries: the three highest-multiplier winning entries across
// all players, cut from the back pages. Cream clippings, each with its
// own masthead (the canonical three), Zilla Slab headline, byline, and
// the entry-minute stamp. Headlines are built from the entry facts only.

import type { LegendaryRow } from "@/app/api/matchday/route";
import { fmtMultiplier } from "@/lib/format";

const MASTHEADS = ["The Matchday Post", "Evening Dispatch", "The Gaffer"];

function headline(row: LegendaryRow): string {
  if (row.entryMinute >= 85) return `THE ${row.entryMinute}TH-MINUTE MIRACLE`;
  if (row.multiplier >= 9.5) return "FROM THE BENCH, A LEGEND";
  if (row.multiplier >= 7.0) return "HE WALKED ON, THEY WALKED OFF";
  return `ON AT ${row.entryMinute}', NEVER IN DOUBT`;
}

export function LegendaryEntries({ rows }: { rows: LegendaryRow[] }) {
  return (
    <section aria-label="Legendary entries" className="panel-quiet overflow-hidden">
      <div className="flex items-baseline justify-between border-b border-pitch-700 px-4 py-2">
        <h2 className="label">Legendary entries</h2>
        <p className="whisper">All players, all time</p>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="hero-number text-sm uppercase tracking-wide text-chalk-300">
            The back page is blank
          </p>
          <p className="mt-1.5 font-label text-xs text-chalk-500">
            No one has won a window from Miracle Territory yet.
          </p>
          <p className="whisper mt-1">The first 10x win writes itself here.</p>
        </div>
      ) : (
        <ul className="grid gap-3 p-3 sm:grid-cols-3">
          {rows.map((row, i) => (
            <li
              key={i}
              className="relative rounded-xl bg-gradient-to-b from-paper to-paper-deep px-3.5 py-3 text-paper-ink shadow-[0_8px_20px_-12px_#000]"
            >
              <div className="flex items-baseline justify-between gap-2 border-b border-paper-ink/25 pb-1">
                <span className="font-masthead text-[14px] leading-none">
                  {MASTHEADS[i % MASTHEADS.length]}
                </span>
                <span className="font-label text-[8px] font-bold uppercase tracking-[0.16em] text-paper-faded">
                  {row.entryMinute}&apos; entry
                </span>
              </div>
              <p className="mt-2 font-slab text-[16px] font-bold leading-[1.05]">
                {headline(row)}
              </p>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <span className="font-slab text-[10px] font-medium tracking-[0.02em] text-paper-faded">
                  {row.playerName} ({row.shirtNumber}) v {row.opponentName} ·{" "}
                  {Math.round(row.finalPoints)} pts
                </span>
                <span className="hero-number text-xl leading-none text-paper-ink">
                  {fmtMultiplier(row.multiplier)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
