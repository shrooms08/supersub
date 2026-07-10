// ENTER THE PITCH. The one action in the game.
//
// The server is authoritative: it reconstructs match state from its own
// source at the entry instant (fold of the log up to entryFeedTs), reads
// the win probability from the odds series at that instant, locks the
// multiplier, and writes the entry. The client's only say is WHEN, via the
// feedTs it last saw on its stream; that timestamp is clamped to the
// source's own notion of now.
//
// One entry per user per fixture is enforced by the database constraint;
// a second attempt returns 409 with the existing entry.

import { NextRequest, NextResponse } from "next/server";
import { getSource } from "@/lib/sources";
import { foldMatch, stateMinute } from "@/lib/state/fold";
import { foldProbSeries, probAt, teamProb } from "@/lib/state/winprob";
import { multiplierForProb } from "@/lib/state/scoring";
import { supabase, type EntryRow } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface EnterBody {
  userId?: string;
  fixtureId?: number;
  team?: number;
  mode?: string;
  speed?: number;
  feedTs?: number;
}

export async function POST(req: NextRequest) {
  let body: EnterBody;
  try {
    body = (await req.json()) as EnterBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const { userId, fixtureId, team } = body;
  if (!userId || typeof userId !== "string" || userId.length > 128) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (!Number.isInteger(fixtureId)) {
    return NextResponse.json({ error: "fixtureId required" }, { status: 400 });
  }
  if (team !== 1 && team !== 2) {
    return NextResponse.json({ error: "team must be 1 or 2" }, { status: 400 });
  }

  const source = getSource({
    mode: body.mode ?? null,
    speed: body.speed !== undefined ? String(body.speed) : null,
  });

  try {
    const sourceNow = await source.feedNow(fixtureId!);
    // The client's clock lags its stream slightly; trust it only within
    // the source's own now.
    const entryFeedTs =
      typeof body.feedTs === "number" && body.feedTs > 0
        ? Math.min(body.feedTs, sourceNow)
        : sourceNow;

    const log = await source.getLog(fixtureId!, entryFeedTs);
    const state = foldMatch(log.events, { feedNow: entryFeedTs });

    if (state.phase !== "live") {
      return NextResponse.json(
        { error: state.phase === "upcoming" ? "The whistle has not gone yet." : "Full time. The bench is closed." },
        { status: 409 }
      );
    }

    const series = foldProbSeries(log.odds);
    const tick = probAt(series, entryFeedTs);
    if (!tick) {
      return NextResponse.json(
        { error: "No win probability available at this instant. Try again in a few seconds." },
        { status: 503 }
      );
    }
    const winProb = teamProb(tick, team as 1 | 2);
    const multiplier = multiplierForProb(winProb);

    const teamName = team === 1 ? log.fixture.participant1 : log.fixture.participant2;
    const opponentName = team === 1 ? log.fixture.participant2 : log.fixture.participant1;
    const scoreTeam = team === 1 ? state.score.p1 : state.score.p2;
    const scoreOpp = team === 1 ? state.score.p2 : state.score.p1;

    const row = {
      user_id: userId,
      fixture_id: fixtureId,
      mode: source.mode,
      team,
      team_name: teamName,
      opponent_name: opponentName,
      entry_feed_ts: entryFeedTs,
      entry_clock_seconds: state.clock?.seconds ?? 0,
      entry_minute: stateMinute(state, entryFeedTs),
      score_team_at_entry: scoreTeam,
      score_opp_at_entry: scoreOpp,
      win_prob_at_entry: winProb,
      multiplier,
    };

    const { data, error } = await supabase()
      .from("entries")
      .insert(row)
      .select()
      .single<EntryRow>();

    if (error) {
      if (error.code === "23505") {
        const { data: existing } = await supabase()
          .from("entries")
          .select()
          .eq("user_id", userId)
          .eq("fixture_id", fixtureId)
          .single<EntryRow>();
        return NextResponse.json(
          { error: "Already on the pitch for this one.", entry: existing },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ entry: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

// Restore an existing entry on reload.
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const fixtureId = Number(req.nextUrl.searchParams.get("fixtureId"));
  if (!userId || !Number.isInteger(fixtureId)) {
    return NextResponse.json({ error: "userId and fixtureId required" }, { status: 400 });
  }
  const { data, error } = await supabase()
    .from("entries")
    .select()
    .eq("user_id", userId)
    .eq("fixture_id", fixtureId)
    .maybeSingle<EntryRow>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: data });
}
