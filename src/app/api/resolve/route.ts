// Resolution at the whistle. Recomputes everything from the final
// event-sourced state; nothing accumulated during the match is trusted
// (locked scoring rule: final points come ONLY from the fold of the full
// log at full time). Idempotent: a resolved entry returns as-is.

import { NextRequest, NextResponse } from "next/server";
import { getSource } from "@/lib/sources";
import { foldMatch } from "@/lib/state/fold";
import { finalPoints, scoreWindow } from "@/lib/state/scoring";
import { supabase, type EntryRow } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ResolveBody {
  userId?: string;
  fixtureId?: number;
  mode?: string;
}

export async function POST(req: NextRequest) {
  let body: ResolveBody;
  try {
    body = (await req.json()) as ResolveBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const { userId, fixtureId } = body;
  if (!userId || !Number.isInteger(fixtureId)) {
    return NextResponse.json({ error: "userId and fixtureId required" }, { status: 400 });
  }

  const { data: entry, error: fetchErr } = await supabase()
    .from("entries")
    .select()
    .eq("user_id", userId)
    .eq("fixture_id", fixtureId)
    .maybeSingle<EntryRow>();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!entry) return NextResponse.json({ error: "No entry for this fixture." }, { status: 404 });
  if (entry.resolved_at) return NextResponse.json({ entry });

  const source = getSource({ mode: body.mode ?? entry.mode });

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

    const window = scoreWindow(
      {
        team: entry.team,
        entryFeedTs: entry.entry_feed_ts,
        scoreTeamAtEntry: entry.score_team_at_entry,
        scoreOppAtEntry: entry.score_opp_at_entry,
      },
      finalState,
      { settled: true }
    );
    const points = finalPoints(window.windowPoints, entry.multiplier);

    const { data: updated, error: updateErr } = await supabase()
      .from("entries")
      .update({
        resolved_at: new Date().toISOString(),
        window_points: window.windowPoints,
        final_points: points,
        final_score_team: window.finalScoreTeam,
        final_score_opp: window.finalScoreOpp,
        breakdown: window.breakdown,
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
      return NextResponse.json({ entry: winner });
    }
    return NextResponse.json({ entry: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
