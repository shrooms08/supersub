"use client";

// Match history detail: the clipping plus the score breakdown for one
// resolved appearance.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MatchReportCard } from "@/components/MatchReportCard";
import { fmtMultiplier, fmtPct, fmtPoints } from "@/lib/format";
import { tierForMultiplier } from "@/lib/config/scoring";
import type { EntryRow } from "@/lib/entry";

export default function MatchReportPage() {
  const params = useParams<{ entryId: string }>();
  const [entry, setEntry] = useState<EntryRow | null>(null);
  const [status, setStatus] = useState<"loading" | "missing" | "ready">("loading");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/career", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body: { history: EntryRow[] }) => {
        if (cancelled) return;
        const found = body.history.find((e) => e.id === params.entryId) ?? null;
        setEntry(found);
        setStatus(found ? "ready" : "missing");
      })
      .catch(() => {
        if (!cancelled) setStatus("missing");
      });
    return () => {
      cancelled = true;
    };
  }, [params.entryId]);

  if (status === "loading") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-4 px-4 py-8">
        <div className="h-48 animate-pulse rounded-lg border border-pitch-700 bg-pitch-850" />
      </main>
    );
  }

  if (status === "missing" || !entry) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center gap-4 px-4 py-8 text-center">
        <p className="font-display text-2xl font-black uppercase tracking-tight text-chalk-50">
          Not in the book
        </p>
        <Link
          href="/career"
          className="min-h-[44px] rounded-md border border-chalk-600 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-chalk-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50"
        >
          Back to the career
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-5 px-4 py-8">
      <header className="flex items-center justify-between gap-2">
        <Link
          href="/career"
          className="whisper rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50"
        >
          &lsaquo; The career
        </Link>
        <p className="whisper">Appearance record</p>
      </header>

      <MatchReportCard entry={entry} />

      <section aria-label="The numbers" className="rounded-lg border border-pitch-700 bg-pitch-900">
        <h2 className="whisper border-b border-pitch-700 px-4 py-2">The numbers</h2>
        <div className="grid grid-cols-3 gap-px bg-pitch-800">
          <div className="bg-pitch-900 px-4 py-3">
            <p className="font-display text-xl font-black tabular-nums text-chalk-50">
              {fmtPoints(entry.final_points ?? 0)}
            </p>
            <p className="whisper mt-0.5">Final points</p>
          </div>
          <div className="bg-pitch-900 px-4 py-3">
            <p className="font-display text-xl font-black tabular-nums text-chalk-50">
              {fmtMultiplier(entry.multiplier)}
            </p>
            <p className="whisper mt-0.5">{tierForMultiplier(entry.multiplier).name}</p>
          </div>
          <div className="bg-pitch-900 px-4 py-3">
            <p className="font-display text-xl font-black tabular-nums text-chalk-50">
              {fmtPct(entry.win_prob_at_entry)}%
            </p>
            <p className="whisper mt-0.5">P(win) at entry</p>
          </div>
        </div>
        <ul className="divide-y divide-pitch-800 border-t border-pitch-700">
          {(entry.breakdown ?? []).map((item, i) => (
            <li key={`${item.type}:${i}`} className="flex items-baseline justify-between gap-3 px-4 py-2">
              <span
                className={`text-sm ${
                  item.type === "goal_overturned" ? "text-chalk-500 line-through" : "text-chalk-200"
                }`}
              >
                {item.label}
              </span>
              <span className="shrink-0 text-sm font-bold tabular-nums text-chalk-50">
                {item.points > 0 ? `+${item.points}` : item.points}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
