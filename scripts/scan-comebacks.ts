// Demo research: scan finished fixtures' score histories for comeback
// arcs (a team trailing who ends level or better). Scores-only, one
// request per fixture. Usage:
//   npx tsx scripts/scan-comebacks.ts 18202701 18193785 ...

import * as fs from "node:fs";
import * as path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

async function main() {
  const { txGetText, txGetJson, epochDay } = await import("../src/lib/server/txline");
  const { normalizeMatchEvent, normalizeFixture, parseArrayOrSseFraming } = await import(
    "../src/lib/feed/normalize"
  );
  const { foldMatch } = await import("../src/lib/state/fold");
  type NormEvent = NonNullable<ReturnType<typeof normalizeMatchEvent>>;

  const ids = process.argv.slice(2).map(Number);
  const lookback = epochDay(Date.now()) - 13;
  const rawFixtures = await txGetJson<unknown[]>(`/fixtures/snapshot?startEpochDay=${lookback}`);
  const fixtures = new Map(
    rawFixtures
      .map(normalizeFixture)
      .filter((f): f is NonNullable<typeof f> => f !== null)
      .map((f) => [f.fixtureId, f])
  );

  for (const id of ids) {
    const fx = fixtures.get(id);
    const label = fx ? `${fx.participant1} v ${fx.participant2}` : String(id);
    try {
      const raw = await txGetText(`/scores/historical/${id}`);
      const events = parseArrayOrSseFraming(raw)
        .map(normalizeMatchEvent)
        .filter((e): e is NormEvent => e !== null)
        .sort((a, b) => a.seq - b.seq);
      if (events.length === 0) {
        console.log(`${id}  ${label}: EMPTY history`);
        continue;
      }
      const final = foldMatch(events);
      // Progressive score timeline at each goal event (net of discards up
      // to that point), to spot trailing spells.
      const timeline: string[] = [];
      let trailedThenRecovered: string | null = null;
      const goalSeqs = final.countables.filter((c) => c.kind === "goal").map((c) => c.seq);
      for (const seq of goalSeqs) {
        const s = foldMatch(events.filter((e) => e.seq <= seq + 1));
        const minute = Math.floor(
          (final.countables.find((c) => c.seq === seq)?.clockSeconds ?? 0) / 60
        ) + 1;
        timeline.push(`${minute}' ${s.score.p1}-${s.score.p2}`);
      }
      // Recovery check per side.
      for (const side of [1, 2] as const) {
        for (const seq of goalSeqs) {
          const s = foldMatch(events.filter((e) => e.seq <= seq + 1));
          const us = side === 1 ? s.score.p1 : s.score.p2;
          const them = side === 1 ? s.score.p2 : s.score.p1;
          const usF = side === 1 ? final.score.p1 : final.score.p2;
          const themF = side === 1 ? final.score.p2 : final.score.p1;
          if (us < them && usF >= themF) {
            const team = side === 1 ? fx?.participant1 : fx?.participant2;
            trailedThenRecovered = `${team} trailed ${us}-${them} and finished ${usF}-${themF}`;
          }
        }
      }
      const discards = final.countables.filter((c) => c.kind === "goal" && c.discarded).length;
      console.log(
        `${id}  ${label}: final ${final.score.p1}-${final.score.p2}  goals[${timeline.join(" -> ")}]` +
          `${discards ? `  VAR-erased goals: ${discards}` : ""}` +
          `${trailedThenRecovered ? `  COMEBACK: ${trailedThenRecovered}` : ""}`
      );
    } catch (err) {
      console.log(`${id}  ${label}: FAILED (${err instanceof Error ? err.message : err})`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
