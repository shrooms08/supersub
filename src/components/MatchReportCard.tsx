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
      className="relative overflow-hidden rounded-[7px] bg-paper px-4 py-4 text-paper-ink shadow-[0_20px_50px_-24px_#000] sm:rounded-lg sm:px-[30px] sm:py-[26px]"
    >
      {/* print scanlines */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: "repeating-linear-gradient(0deg, transparent 0 3px, rgba(20,18,16,.03) 3px 4px)",
        }}
      />

      <header className="relative border-b-[3px] border-double border-paper-ink pb-2 text-center sm:pb-2.5">
        <div className="flex justify-between font-label text-[6px] font-bold tracking-[0.1em] text-paper-faded sm:text-[8px] sm:tracking-[0.14em]">
          <span>WORLD CUP 2026</span>
          <span>{date.toUpperCase()}</span>
          <span>PRICE {fmtMultiplier(entry.multiplier).toUpperCase()}</span>
        </div>
        <p className="mt-1 font-masthead text-[30px] leading-none sm:mt-1.5 sm:text-[46px]">
          The Substitute&apos;s Gazette
        </p>
      </header>

      <h3 className="relative mt-2.5 text-center font-slab text-[26px] font-bold uppercase leading-[0.98] tracking-tight sm:mt-3.5 sm:text-[38px]">
        {entry.team_name} {entry.final_score_team}&ndash;{entry.final_score_opp}{" "}
        {entry.opponent_name}
      </h3>

      <div className="relative mt-2 flex flex-wrap justify-center gap-x-2.5 gap-y-1 border-y border-paper-ink py-1.5 font-label text-[6.5px] font-semibold tracking-[0.12em] text-paper-faded sm:mt-2.5 sm:gap-x-4 sm:text-[8px] sm:tracking-[0.14em]">
        <span>{entry.report_source === "model" ? "BY OUR FOOTBALL CORRESPONDENT" : "FROM THE WIRE"}</span>
        <span>·</span>
        <span>ENTERED {entry.entry_minute}&apos;</span>
        <span>·</span>
        <span>+{entry.final_points} IMPACT</span>
        {won && (
          <>
            <span>·</span>
            <span className="rounded-sm bg-volt px-1 font-black text-pitch-950">WIN</span>
          </>
        )}
      </div>

      <p
        className="relative mt-2.5 font-slab text-[10.5px] leading-[1.45] [column-count:2] [column-gap:12px] sm:mt-3.5 sm:text-[12.5px] sm:leading-[1.5] sm:[column-count:3] sm:[column-gap:18px]"
        style={{ textAlign: "justify" }}
      >
        {entry.report}
      </p>

      <footer className="relative mt-2.5 flex items-center justify-between border-t-2 border-paper-ink pt-2 sm:mt-3.5 sm:pt-3">
        <p className="font-slab text-[10px] font-bold sm:text-[13px]">
          WINDOW MULTIPLIER{" "}
          <span className="text-[16px] sm:text-[22px]">{fmtMultiplier(entry.multiplier)}</span> ·{" "}
          {tierForMultiplier(entry.multiplier).name.toUpperCase()}
        </p>
        <p className="rounded-[16px] border border-paper-ink px-2.5 py-[5px] font-label text-[6.5px] font-bold tracking-[0.12em] text-paper-faded sm:rounded-[20px] sm:px-3 sm:py-1.5 sm:text-[8px] sm:tracking-[0.16em]">
          &#9704; SCREENSHOT TO SHARE
        </p>
      </footer>
    </article>
  );
}
