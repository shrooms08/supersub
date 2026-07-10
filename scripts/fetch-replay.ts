// Fetch a finished fixture from the TxLINE historical endpoints through the
// app's replay source and cache it under .cache/replay/. Usage:
//   npx tsx scripts/fetch-replay.ts            # list candidates
//   npx tsx scripts/fetch-replay.ts <fixtureId>  # fetch and cache one
//
// Promote a cached fixture into the committed bundle by copying
// .cache/replay/<id>/ to data/replay/<id>/.

import * as fs from "node:fs";
import * as path from "node:path";

// Load .env.local the way Next.js would (tsx does not).
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

async function main() {
  const { txGetJson, epochDay } = await import("../src/lib/server/txline");
  const { normalizeFixture } = await import("../src/lib/feed/normalize");
  const { createReplaySource } = await import("../src/lib/sources/replay");

  const target = process.argv[2] ? Number(process.argv[2]) : undefined;

  if (!target) {
    const lookback = epochDay(Date.now()) - 13;
    const raw = await txGetJson<unknown[]>(`/fixtures/snapshot?startEpochDay=${lookback}`);
    const now = Date.now();
    const finished = raw
      .map(normalizeFixture)
      .filter((f): f is NonNullable<typeof f> => f !== null)
      .filter((f) => f.startTime < now - 6 * 3600_000)
      .sort((a, b) => b.startTime - a.startTime);
    console.log(`${finished.length} fixtures in the historical window (6h to ~2 weeks back):`);
    for (const f of finished) {
      console.log(
        `  ${f.fixtureId}  ${f.participant1} v ${f.participant2}  (${f.competition}, kicked off ${new Date(f.startTime).toISOString()})`
      );
    }
    return;
  }

  const source = createReplaySource();
  const fixture = await source.getFixture(target);
  if (!fixture) throw new Error(`fixture ${target} could not be loaded`);
  const log = await source.getLog(target, Number.MAX_SAFE_INTEGER);
  console.log(
    `[fetched] ${fixture.participant1} v ${fixture.participant2}: ${log.events.length} events, ${log.odds.length} FT 1X2 odds. Cached under .cache/replay/${target}/`
  );
}

main().catch((err) => {
  console.error(`[fatal] ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
