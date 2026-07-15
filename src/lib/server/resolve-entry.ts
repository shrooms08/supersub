// Server-side resolution, independent of any watcher's session. This is
// the single source of truth for turning an entry into a resolved career
// row: the /api/resolve route (a watcher reaching full time) and the
// resolution sweep (a cron that finds finished fixtures with unresolved
// entries) both call it. The fold is deterministic, so resolving from the
// event-sourced log is safe and idempotent no matter who, if anyone, was
// watching at the whistle.

import { getSource } from "@/lib/sources";
import { foldMatch, regulationLog, type MatchState } from "@/lib/state/fold";
import { finalPoints, scoreWindow } from "@/lib/state/scoring";
import { supabase } from "@/lib/server/supabase";
import { buildReportFacts, generateMatchReport } from "@/lib/server/report";
import { evaluateBadges } from "@/lib/career/badges";
import { isBundledReplay } from "@/lib/playability";
import type { EntryRow } from "@/lib/entry";
import type { PlayerRow } from "@/lib/player";

// Fold a fixture's full log to its final and regulation states. Used to
// decide whether the whistle has gone and to score the window.
export async function loadFixtureFold(
  mode: string,
  fixtureId: number,
  opts: { speed?: number; anchor?: number } = {}
): Promise<{ finalState: MatchState; regulationState: MatchState; finished: boolean }> {
  const source = getSource({
    mode,
    speed: opts.speed !== undefined ? String(opts.speed) : null,
    anchor: opts.anchor ?? null,
  });
  const feedNow = await source.feedNow(fixtureId);
  const log = await source.getLog(fixtureId);
  const finalState = foldMatch(log.events, { feedNow });
  const regulationState = foldMatch(regulationLog(log.events), { feedNow });
  return { finalState, regulationState, finished: finalState.phase === "finished" };
}

// Resolve one entry against an already-computed regulation fold. Writes
// the resolution (score, breakdown, report, exhibition flag), then
// evaluates and persists badges. Idempotent: the update is guarded on
// resolved_at still being null, so a race or a double-run is harmless.
export async function resolveEntryAgainst(
  entry: EntryRow,
  player: PlayerRow,
  regulationState: MatchState
): Promise<{ entry: EntryRow; newBadges: string[] }> {
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

  const { data: updated } = await supabase()
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
      exhibition: isBundledReplay(entry.fixture_id),
    })
    .eq("id", entry.id)
    .is("resolved_at", null)
    .select()
    .maybeSingle<EntryRow>();

  if (!updated) {
    // Someone (or the sweep) resolved it first; return the settled row.
    const { data: winner } = await supabase()
      .from("entries")
      .select()
      .eq("id", entry.id)
      .single<EntryRow>();
    return { entry: winner as EntryRow, newBadges: [] };
  }

  // Badges: total resolved appearances (for the debut) and live-only
  // appearances (for the appearance-gated badges), both including this
  // entry which was just written with its exhibition flag.
  const isExhibition = isBundledReplay(entry.fixture_id);
  const [{ count: totalCount }, { count: liveCount }] = await Promise.all([
    supabase()
      .from("entries")
      .select("id", { count: "exact", head: true })
      .eq("player_id", player.id)
      .not("resolved_at", "is", null),
    supabase()
      .from("entries")
      .select("id", { count: "exact", head: true })
      .eq("player_id", player.id)
      .not("resolved_at", "is", null)
      .eq("exhibition", false),
  ]);

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
    totalCount ?? 1,
    { exhibition: isExhibition, liveAppearances: liveCount ?? 0 }
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
      const rows = newBadges.map((badge) => ({ player_id: player.id, badge, entry_id: updated.id }));
      const { error: badgeErr } = await supabase()
        .from("player_badges")
        .upsert(rows, { onConflict: "player_id,badge", ignoreDuplicates: true });
      if (badgeErr) {
        const { error: retryErr } = await supabase().from("player_badges").insert(rows);
        if (retryErr && retryErr.code !== "23505") newBadges = [];
      }
    }
  }

  return { entry: updated, newBadges };
}

export interface SweepResult {
  resolved: { entryId: string; fixtureId: number; playerName: string; points: number }[];
  skippedLive: number[]; // fixture ids still in play
  errors: { entryId: string; message: string }[];
}

// The sweep: find every unresolved entry, group by fixture, fold each
// finished fixture once, and resolve its entries. Fixtures still in play
// are left for a later run. This is what makes resolution independent of
// whether anyone was watching.
export async function resolveFinishedEntries(): Promise<SweepResult> {
  const result: SweepResult = { resolved: [], skippedLive: [], errors: [] };

  const { data: unresolved } = await supabase()
    .from("entries")
    .select("*, players(id, name, position, shirt_number, created_at)")
    .is("resolved_at", null)
    .returns<(EntryRow & { players: PlayerRow | null })[]>();
  if (!unresolved || unresolved.length === 0) return result;

  // Group by fixture (and mode, so a fixture is folded once).
  const byFixture = new Map<string, (EntryRow & { players: PlayerRow | null })[]>();
  for (const e of unresolved) {
    const key = `${e.fixture_id}:${e.mode}`;
    const list = byFixture.get(key) ?? [];
    list.push(e);
    byFixture.set(key, list);
  }

  for (const [key, entries] of byFixture) {
    const { fixture_id, mode } = entries[0];
    let fold: Awaited<ReturnType<typeof loadFixtureFold>>;
    try {
      fold = await loadFixtureFold(mode, fixture_id);
    } catch (err) {
      for (const e of entries) {
        result.errors.push({ entryId: e.id, message: `fold ${key}: ${err instanceof Error ? err.message : err}` });
      }
      continue;
    }
    if (!fold.finished) {
      result.skippedLive.push(fixture_id);
      continue;
    }
    for (const e of entries) {
      const player = e.players;
      if (!player) {
        result.errors.push({ entryId: e.id, message: "no player row" });
        continue;
      }
      try {
        const { entry: resolved } = await resolveEntryAgainst(e, player, fold.regulationState);
        result.resolved.push({
          entryId: e.id,
          fixtureId: fixture_id,
          playerName: player.name,
          points: resolved.final_points ?? 0,
        });
      } catch (err) {
        result.errors.push({ entryId: e.id, message: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  return result;
}
