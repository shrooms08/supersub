// Match Detail: the full story of a finished match, as a broadcast
// timeline. Read-only, no entry paths anywhere. Styling follows the live
// ticker (glyph chip, minute, team, name); VAR-overturned goals are
// shown struck through because the overturn is part of the story and our
// event-sourcing proof. Flags come from the shared flags module.

import Link from "next/link";
import { flagFor } from "@/lib/flags";
import type { MatchTimeline, TimelineEvent } from "@/lib/server/match-timeline";

const KIND_CHIP: Record<string, { glyph: string; bg: string; col: string; label: string }> = {
  goal: { glyph: "●", bg: "rgba(200,255,0,.16)", col: "#c8ff00", label: "Goal" },
  var_overturn: { glyph: "●", bg: "#26262c", col: "#a1a1aa", label: "Goal" },
  yellow_card: { glyph: "▮", bg: "rgba(234,179,8,.18)", col: "#facc15", label: "Yellow card" },
  red_card: { glyph: "▮", bg: "rgba(220,38,38,.22)", col: "#f87171", label: "Red card" },
  substitution: { glyph: "⇄", bg: "#22222a", col: "#d4d4d8", label: "Substitution" },
};

function fmtDate(ts: number | null): string {
  if (!ts) return "";
  return new Date(ts)
    .toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .toUpperCase();
}

function teamCode(name: string): string {
  return name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "---";
}

function pensLine(t: MatchTimeline): string | null {
  if (!t.pens || t.pens.p1 === t.pens.p2) return null;
  const winner = t.pens.p1 > t.pens.p2 ? t.participant1 : t.participant2;
  return `${teamCode(winner)} advanced on penalties ${Math.max(t.pens.p1, t.pens.p2)}-${Math.min(
    t.pens.p1,
    t.pens.p2
  )}`;
}

function TeamLabel({ name }: { name: string }) {
  const flag = flagFor(name);
  return (
    <span className="inline-flex items-center gap-1.5">
      {flag && <span aria-hidden>{flag}</span>}
      <span>{name}</span>
    </span>
  );
}

function PeriodBreak({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-3 py-3" aria-label={`Period: ${label}`}>
      <span className="h-px flex-1 bg-white/[0.08]" />
      <span className="font-label text-[9px] font-bold uppercase tracking-[0.2em] text-chalk-500">
        {label}
      </span>
      <span className="h-px flex-1 bg-white/[0.08]" />
    </li>
  );
}

function Row({ e, t }: { e: TimelineEvent; t: MatchTimeline }) {
  const chip = KIND_CHIP[e.kind] ?? KIND_CHIP.goal;
  const teamName = e.team === 1 ? t.participant1 : e.team === 2 ? t.participant2 : null;
  const flag = teamName ? flagFor(teamName) : null;
  const struck = e.kind === "var_overturn";

  // The line of copy: a name when the roster resolved it, otherwise the
  // team, so an event is never blank and a name is never invented.
  let line: string;
  if (e.kind === "substitution") {
    if (e.playerName || e.secondaryName) {
      line = `${e.playerName ?? "?"} on${e.secondaryName ? `, ${e.secondaryName} off` : ""}`;
    } else {
      line = teamName ? `${teamName} substitution` : "Substitution";
    }
  } else {
    line = e.playerName ?? teamName ?? "";
  }

  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="hero-number w-9 shrink-0 text-right text-[15px] leading-none text-chalk-400">
        {e.minute !== null ? `${e.minute}'` : "--"}
      </span>
      <span
        aria-hidden
        className="grid h-7 w-7 flex-none place-items-center rounded-[7px] font-label text-[12px] font-bold"
        style={{ background: chip.bg, color: chip.col }}
      >
        {chip.glyph}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="font-label text-[7px] font-bold uppercase tracking-[0.12em] text-chalk-500">
            {chip.label}
          </span>
          {struck && (
            <span className="shrink-0 rounded-sm bg-pitch-700 px-1.5 py-0.5 font-label text-[8px] font-bold uppercase tracking-[0.14em] text-chalk-300">
              VAR: overturned
            </span>
          )}
        </span>
        <span
          className={`mt-0.5 flex items-center gap-1.5 font-label text-[12px] leading-[1.3] ${
            struck ? "text-chalk-500 line-through" : e.kind === "goal" ? "font-semibold text-chalk-100" : "text-chalk-300"
          }`}
        >
          {flag && (
            <span aria-hidden className="not-italic no-underline">
              {flag}
            </span>
          )}
          {line}
        </span>
      </span>
    </li>
  );
}

export function MatchReport({ timeline }: { timeline: MatchTimeline }) {
  const pens = pensLine(timeline);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between gap-2">
        <p className="font-label text-[9px] font-bold uppercase tracking-[0.22em] text-volt">
          Match report
        </p>
        <Link
          href="/"
          className="whisper rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50"
        >
          &lsaquo; The bench
        </Link>
      </header>

      {/* Header: score, competition, date, pens verdict */}
      <section
        aria-label="Final result"
        className="panel relative overflow-hidden !rounded-2xl !bg-gradient-to-br !from-pitch-800 !to-[#0c0c0f] p-5 text-center"
      >
        <p className="font-label text-[9px] font-semibold uppercase tracking-[0.18em] text-chalk-600">
          {timeline.competition || "Football"} · {fmtDate(timeline.startTime)}
        </p>
        <div className="mt-3 flex items-center justify-center gap-4">
          <span className="hero-number min-w-0 flex-1 truncate text-right text-xl uppercase leading-none text-chalk-50">
            <TeamLabel name={timeline.participant1} />
          </span>
          <span className="hero-number shrink-0 text-[44px] leading-[0.8] tracking-[0.04em] text-chalk-50">
            {timeline.score.p1}&ndash;{timeline.score.p2}
          </span>
          <span className="hero-number min-w-0 flex-1 truncate text-left text-xl uppercase leading-none text-chalk-50">
            <TeamLabel name={timeline.participant2} />
          </span>
        </div>
        {timeline.live ? (
          <p className="mt-2 inline-flex items-center gap-1.5 font-label text-[9px] font-bold uppercase tracking-[0.16em] text-volt">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-volt animate-live-pulse" />
            Live
            {timeline.currentMinute !== null ? ` · ${timeline.currentMinute}'` : ""}
          </p>
        ) : (
          <p className="mt-2 font-label text-[9px] font-semibold uppercase tracking-[0.14em] text-chalk-500">
            {timeline.wentToExtraTime ? "After extra time" : "Full time"}
            {pens ? ` · ${pens}` : ""}
          </p>
        )}
      </section>

      {timeline.live && (
        <p className="-mt-2 px-1 text-center font-label text-[9px] leading-relaxed text-chalk-600">
          This is the story so far. It updates as the match unfolds; refresh for the latest.
        </p>
      )}

      {/* Timeline */}
      <section aria-label="Timeline" className="panel !rounded-2xl px-4 py-2">
        {timeline.events.length === 0 ? (
          <p className="py-8 text-center font-label text-sm text-chalk-500">
            No timeline events on record for this match.
          </p>
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {timeline.events.map((e, i) =>
              e.kind === "period" ? (
                <PeriodBreak key={`p${i}`} label={e.label ?? ""} />
              ) : (
                <Row key={`e${e.seq}-${i}`} e={e} t={timeline} />
              )
            )}
          </ul>
        )}
        {!timeline.hasRoster && (
          <p className="border-t border-white/[0.06] px-1 py-3 font-label text-[9px] leading-relaxed text-chalk-600">
            No team sheet in the feed for this match, so events show the side and minute without
            player names. Nothing is guessed.
          </p>
        )}
      </section>
    </main>
  );
}
