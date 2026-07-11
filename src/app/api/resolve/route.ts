// Resolution at the whistle. Recomputes everything from the final
// event-sourced state; nothing accumulated during the match is trusted
// (locked scoring rule: final points come ONLY from the fold of the full
// log at full time). Idempotent: a resolved entry returns as-is.
//
// Phase 2 additions, both inside the single resolution write:
//   - the match report is generated once (model with template fallback)
//     and stored on the entry, never regenerated
//   - badges are evaluated against the resolved entry and persisted;
//     duplicates are absorbed by the primary key

import { NextRequest, NextResponse } from "next/server";
import { getSource } from "@/lib/sources";
import { foldMatch, regulationLog } from "@/lib/state/fold";
import { finalPoints, scoreWindow } from "@/lib/state/scoring";
import { supabase } from "@/lib/server/supabase";
import { currentPlayer } from "@/lib/server/playerAuth";
import { buildReportFacts, generateMatchReport } from "@/lib/server/report";
import { evaluateBadges } from "@/lib/career/badges";
import type { EntryRow } from "@/lib/entry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Resolution includes the one-shot report generation (up to a 20s model
// call); give it room beyond the default function limit.
export const maxDuration = 60;

interface ResolveBody {
  fixtureId?: number;
  mode?: string;
  // Replay timeline anchor and speed (see src/lib/sources/replay.ts).
  // Both are needed: a fresh serverless instance reconstructs the session
  // from them, and the wrong speed puts the virtual clock mid-match.
  anchor?: number;
  speed?: number;
}

export async function POST(req: NextRequest) {
  const player = await currentPlayer();
  if (!player) {
    return NextResponse.json({ error: "No player on the books." }, { status: 401 });
  }

  let body: ResolveBody;
  try {
    body = (await req.json()) as ResolveBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const { fixtureId } = body;
  if (!Number.isInteger(fixtureId)) {
    return NextResponse.json({ error: "fixtureId required" }, { status: 400 });
  }

  const { data: entry, error: fetchErr } = await supabase()
    .from("entries")
    .select()
    .eq("player_id", player.id)
    .eq("fixture_id", fixtureId)
    .maybeSingle<EntryRow>();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!entry) return NextResponse.json({ error: "No entry for this fixture." }, { status: 404 });
  if (entry.resolved_at) return NextResponse.json({ entry, newBadges: [] });

  const source = getSource({
    mode: body.mode ?? entry.mode,
    speed: body.speed !== undefined ? String(body.speed) : null,
    anchor: body.anchor ?? null,
  });

  try {
    const feedNow = await source.feedNow(fixtureId!);
    const log = await source.getLog(fixtureId!);
    const finalState = foldMatch(log.events, { feedNow });

    if (finalState.phase !== "finished") {
      return NextResponse.json(
        { error: "The whistle has not gone yet; nothing to resolve." },
        { status: 409 }
      );
    }

    // Windows settle at the REGULATION whistle: extra-time goals and
    // shootout kicks live outside the 1X2 event space that priced the
    // multiplier, so the window is scored against the regulation fold.
    // For a match that never went past 90 the two folds are identical.
    const regulationState = foldMatch(regulationLog(log.events), { feedNow });

    const window = scoreWindow(
      {
        team: entry.team,
        entryFeedTs: entry.entry_feed_ts,
        scoreTeamAtEntry: entry.score_team_at_entry,
        scoreOppAtEntry: entry.score_opp_at_entry,
      },
      regulationState,
      { settled: true }
    );
    const points = finalPoints(window.windowPoints, entry.multiplier);

    // The report is part of the resolution write: generated once from the
    // resolved facts, stored, never regenerated.
    const resolvedForReport: EntryRow = {
      ...entry,
      window_points: window.windowPoints,
      final_points: points,
      final_score_team: window.finalScoreTeam,
      final_score_opp: window.finalScoreOpp,
      breakdown: window.breakdown,
    };
    const { report, source: reportSource } = await generateMatchReport(
      buildReportFacts(resolvedForReport, player)
    );

    const { data: updated, error: updateErr } = await supabase()
      .from("entries")
      .update({
        resolved_at: new Date().toISOString(),
        window_points: window.windowPoints,
        final_points: points,
        final_score_team: window.finalScoreTeam,
        final_score_opp: window.finalScoreOpp,
        breakdown: window.breakdown,
        report,
        report_source: reportSource,
      })
      .eq("id", entry.id)
      .is("resolved_at", null)
      .select()
      .maybeSingle<EntryRow>();
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    if (!updated) {
      // Raced with another resolution; return what won.
      const { data: winner } = await supabase()
        .from("entries")
        .select()
        .eq("id", entry.id)
        .single<EntryRow>();
      return NextResponse.json({ entry: winner, newBadges: [] });
    }

    // Badge evaluation against the resolved entry. Appearances counts
    // resolved entries including this one.
    const { count } = await supabase()
      .from("entries")
      .select("id", { count: "exact", head: true })
      .eq("player_id", player.id)
      .not("resolved_at", "is", null);
    const appearances = count ?? 1;

    const earned = evaluateBadges(
      {
        entry_minute: updated.entry_minute,
        win_prob_at_entry: updated.win_prob_at_entry,
        score_team_at_entry: updated.score_team_at_entry,
        score_opp_at_entry: updated.score_opp_at_entry,
        final_score_team: updated.final_score_team ?? 0,
        final_score_opp: updated.final_score_opp ?? 0,
        breakdown: updated.breakdown ?? [],
      },
      appearances
    );

    let newBadges: string[] = [];
    if (earned.length > 0) {
      const { data: existing } = await supabase()
        .from("player_badges")
        .select("badge")
        .eq("player_id", player.id)
        .returns<{ badge: string }[]>();
      const already = new Set((existing ?? []).map((b) => b.badge));
      newBadges = earned.filter((b) => !already.has(b));
      if (newBadges.length > 0) {
        const rows = newBadges.map((badge) => ({
          player_id: player.id,
          badge,
          entry_id: updated.id,
        }));
        const { error: badgeErr } = await supabase()
          .from("player_badges")
          .upsert(rows, { onConflict: "player_id,badge", ignoreDuplicates: true });
        if (badgeErr) {
          // The cabinet must not lose a badge to a transient: retry as a
          // plain insert (the primary key still absorbs duplicates).
          console.error(`[resolve] badge upsert failed (${badgeErr.message}); retrying insert`);
          const { error: retryErr } = await supabase().from("player_badges").insert(rows);
          if (retryErr && retryErr.code !== "23505") {
            console.error(`[resolve] badge insert retry failed: ${retryErr.message}`);
            newBadges = [];
          }
        }
      }
    }

    return NextResponse.json({ entry: updated, newBadges });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
