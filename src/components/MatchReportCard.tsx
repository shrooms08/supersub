// The clipping: the stored match report styled like a cutting from the
// morning paper. This is the shareable artifact, so it carries its own
// masthead and dateline and holds up as a screenshot on its own.

import type { EntryRow } from "@/lib/entry";
import { tierForMultiplier } from "@/lib/config/scoring";
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

  return (
    <article
      aria-label="Match report"
      className="rounded-sm border border-chalk-600/40 bg-chalk-50 px-5 py-4 text-pitch-950 shadow-lg"
    >
      <header className="border-b-2 border-pitch-950 pb-2">
        <p className="font-display text-[10px] font-black uppercase tracking-[0.3em]">
          The Substitute&apos;s Gazette
        </p>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <h3 className="font-display text-lg font-black uppercase leading-tight tracking-tight">
            {entry.team_name} {entry.final_score_team} - {entry.final_score_opp}{" "}
            {entry.opponent_name}
          </h3>
        </div>
        <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-pitch-500">
          {date} · On from {entry.entry_minute}&apos; · {tierForMultiplier(entry.multiplier).name}{" "}
          ({fmtMultiplier(entry.multiplier)})
        </p>
      </header>
      <p className="mt-3 font-serif text-[15px] leading-relaxed">{entry.report}</p>
      <footer className="mt-3 flex items-center justify-between border-t border-pitch-950/20 pt-2">
        <p className="text-[10px] uppercase tracking-[0.18em] text-pitch-500">
          {entry.report_source === "model" ? "Our correspondent" : "From the wire"}
        </p>
        <p className="font-display text-sm font-black tabular-nums">
          {entry.final_points} pts
        </p>
      </footer>
    </article>
  );
}
