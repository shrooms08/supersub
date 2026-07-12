// Cheap current state for a live fixture: the score and derived match
// minute (or an HT / ET label), from the per-action snapshot only. One
// snapshot call, folded through the existing pipeline, cached briefly so
// the bench can poll a handful of live fixtures without per-card streams.
// Read-only; never scores, never enters.

import { normalizeMatchEvent } from "@/lib/feed/normalize";
import { foldMatch, stateMinute } from "@/lib/state/fold";
import { txGetJson } from "@/lib/server/txline";
import type { MatchEvent } from "@/lib/feed/types";

export interface LiveState {
  score: { p1: number; p2: number };
  minute: number;
  // "HT" or "ET" when the match is in one of those, else null (show the
  // minute). Penalties stay display-only elsewhere and are not surfaced
  // here as a scoreline.
  label: string | null;
  live: boolean;
}

const TTL_MS = 30_000;
const cache = new Map<number, { at: number; data: LiveState | null }>();

function labelFor(statusId: number | undefined, wentToExtraTime: boolean): string | null {
  if (statusId === 3) return "HT";
  if (wentToExtraTime) return "ET";
  return null;
}

export async function liveMatchState(fixtureId: number): Promise<LiveState | null> {
  const hit = cache.get(fixtureId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  let raw: unknown[];
  try {
    raw = await txGetJson<unknown[]>(`/scores/snapshot/${fixtureId}`);
  } catch {
    cache.set(fixtureId, { at: Date.now(), data: null });
    return null;
  }
  const events = (Array.isArray(raw) ? raw : [])
    .map(normalizeMatchEvent)
    .filter((e): e is MatchEvent => e !== null);
  if (events.length === 0) {
    cache.set(fixtureId, { at: Date.now(), data: null });
    return null;
  }

  const now = Date.now();
  const state = foldMatch(events, { feedNow: now });
  const data: LiveState = {
    score: state.score,
    minute: stateMinute(state, now),
    label: labelFor(state.statusId, state.wentToExtraTime),
    live: state.phase !== "finished",
  };
  cache.set(fixtureId, { at: now, data });
  return data;
}

// Batch: current state for several live fixtures at once. Each is
// independently cached, so overlapping polls share the work.
export async function liveMatchStates(
  fixtureIds: number[]
): Promise<Record<number, LiveState>> {
  const out: Record<number, LiveState> = {};
  await Promise.all(
    fixtureIds.map(async (id) => {
      const s = await liveMatchState(id).catch(() => null);
      if (s) out[id] = s;
    })
  );
  return out;
}
