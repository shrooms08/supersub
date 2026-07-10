// The entry row as persisted in Supabase (snake_case, straight from the
// table) plus the client-side API helpers around it. Shared by route
// handlers and components; contains no server-only imports.

import type { BreakdownItem } from "@/lib/state/scoring";

export interface EntryRow {
  id: string;
  user_id: string;
  player_id: string;
  fixture_id: number;
  mode: "replay" | "live";
  team: 1 | 2;
  team_name: string;
  opponent_name: string;
  entry_feed_ts: number;
  entry_clock_seconds: number;
  entry_minute: number;
  score_team_at_entry: number;
  score_opp_at_entry: number;
  win_prob_at_entry: number;
  multiplier: number;
  created_at: string;
  resolved_at: string | null;
  window_points: number | null;
  final_points: number | null;
  final_score_team: number | null;
  final_score_opp: number | null;
  breakdown: BreakdownItem[] | null;
  // The match report, stored once at resolution (Phase 2).
  report: string | null;
  report_source: "model" | "template" | null;
}

// Identity travels in the signed player cookie; no ids in these payloads.

export async function fetchEntry(fixtureId: number): Promise<EntryRow | null> {
  const res = await fetch(`/api/enter?fixtureId=${fixtureId}`, { cache: "no-store" });
  if (!res.ok) return null;
  const body = (await res.json()) as { entry: EntryRow | null };
  return body.entry;
}

export async function postEnter(params: {
  fixtureId: number;
  team: 1 | 2;
  mode?: string | null;
  speed?: string | null;
  feedTs?: number;
  anchor?: number | null;
}): Promise<{ entry?: EntryRow; error?: string; status: number }> {
  const res = await fetch("/api/enter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fixtureId: params.fixtureId,
      team: params.team,
      mode: params.mode ?? undefined,
      speed: params.speed !== undefined && params.speed !== null ? Number(params.speed) : undefined,
      feedTs: params.feedTs,
      anchor: params.anchor ?? undefined,
    }),
  });
  const body = (await res.json()) as { entry?: EntryRow; error?: string };
  return { ...body, status: res.status };
}

export async function postResolve(params: {
  fixtureId: number;
  mode?: string | null;
  anchor?: number | null;
  speed?: number | null;
}): Promise<{ entry?: EntryRow; error?: string; newBadges?: string[]; status: number }> {
  const res = await fetch("/api/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fixtureId: params.fixtureId,
      mode: params.mode ?? undefined,
      anchor: params.anchor ?? undefined,
      speed: params.speed ?? undefined,
    }),
  });
  const body = (await res.json()) as { entry?: EntryRow; error?: string; newBadges?: string[] };
  return { ...body, status: res.status };
}
