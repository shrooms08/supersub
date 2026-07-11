// The clipping: the stored match report as a cream broadsheet cutting.
// Pirata One masthead, Zilla Slab two-column body with a halftone rule
// between, print-grayscale throughout; when the window was won, the WIN
// chip is the only volt on the page. This is the shareable artifact.

import type { EntryRow } from "@/lib/entry";
import { tierForMultiplier } from "@/lib/config/scoring";
import { windowResult } from "@/lib/career/window";
import { fmtMultiplier } from "@/lib/format";

export function MatchReportCard({ entry }: { entry: EntryRow }) {
  if (!entry.report) return null;
  const date = entry.resolved_at
    ? new Date(entry.resolved_at).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : "";
  const won = windowResult(entry.breakdown) === "W";

  return (
    <article
      aria-label="Match report"
      className="rounded-xl bg-gradient-to-b from-paper to-paper-deep px-5 py-4 text-paper-ink shadow-[0_8px_20px_-12px_#000]"
    >
      <header className="border-b-2 border-paper-ink pb-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-masthead text-[26px] leading-none sm:text-[42px]">
            The Substitute&apos;s Gazette
          </p>
          {won && (
            <span className="shrink-0 rounded-sm bg-volt px-1.5 py-0.5 font-label text-[10px] font-black uppercase tracking-[0.16em] text-pitch-950">
              Win
            </span>
          )}
        </div>
        <h3 className="mt-1.5 font-slab text-lg font-bold uppercase leading-tight tracking-tight">
          {entry.team_name} {entry.final_score_team} - {entry.final_score_opp}{" "}
          {entry.opponent_name}
        </h3>
        <p className="mt-0.5 font-label text-[10px] uppercase tracking-[0.18em] text-paper-faded">
          {date} · On from {entry.entry_minute}&apos; · {tierForMultiplier(entry.multiplier).name}{" "}
          ({fmtMultiplier(entry.multiplier)})
        </p>
      </header>
      <p
        className="mt-3 font-slab text-[13px] leading-relaxed sm:columns-2 sm:gap-6"
        style={{ columnRule: "1px dotted rgba(20, 18, 16, 0.35)" }}
      >
        {entry.report}
      </p>
      <footer className="mt-3 flex items-center justify-between border-t border-paper-ink/20 pt-2">
        <p className="font-label text-[10px] uppercase tracking-[0.18em] text-paper-faded">
          {entry.report_source === "model" ? "Our correspondent" : "From the wire"}
        </p>
        <p className="hero-number text-lg text-paper-ink">{entry.final_points} pts</p>
      </footer>
    </article>
  );
}
