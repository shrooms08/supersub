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
import { supabase } from "@/lib/server/supabase";
import { currentPlayer } from "@/lib/server/playerAuth";
import { loadFixtureFold, resolveEntryAgainst } from "@/lib/server/resolve-entry";
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

  try {
    // Resolution now lives in one server-side path (shared with the
    // resolution sweep), so an entry resolves identically whether a
    // watcher triggers it here or the cron finds it later.
    const { regulationState, finished } = await loadFixtureFold(body.mode ?? entry.mode, fixtureId!, {
      speed: body.speed,
      anchor: body.anchor,
    });
    if (!finished) {
      return NextResponse.json(
        { error: "The whistle has not gone yet; nothing to resolve." },
        { status: 409 }
      );
    }
    const { entry: updated, newBadges } = await resolveEntryAgainst(entry, player, regulationState);
    return NextResponse.json({ entry: updated, newBadges });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
