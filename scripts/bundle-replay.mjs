// One-off bundler: copies the Phase 0 spike captures for France v Morocco
// (fixture 18209181) into data/replay/ so REPLAY mode works offline on a
// fresh clone. The score log is kept complete (all 1116 raw PascalCase
// events, VAR discard included); the odds file is slimmed to the full-time
// 1X2 consensus records, which is the only market the app consumes.
//
// The bundled files are committed. Re-run only if the spike samples change:
//   SPIKE_DIR=../supersub-spike npm run bundle-replay

import * as fs from "node:fs";
import * as path from "node:path";

const SPIKE_DIR = process.env.SPIKE_DIR ?? path.join(process.cwd(), "..", "supersub-spike");
const FIXTURE_ID = 18209181;
const OUT_DIR = path.join(process.cwd(), "data", "replay", String(FIXTURE_ID));

const scoresPath = path.join(SPIKE_DIR, "samples", "replay-scores.json");
const oddsPath = path.join(SPIKE_DIR, "samples", "replay-odds.json");
if (!fs.existsSync(scoresPath) || !fs.existsSync(oddsPath)) {
  console.error(`Spike samples not found under ${SPIKE_DIR}/samples. Set SPIKE_DIR.`);
  process.exit(1);
}

const scores = JSON.parse(fs.readFileSync(scoresPath, "utf8"));
const odds = JSON.parse(fs.readFileSync(oddsPath, "utf8"));

const ft1x2 = odds
  .filter((o) => o.SuperOddsType === "1X2_PARTICIPANT_RESULT" && o.MarketPeriod === null)
  .sort((a, b) => a.Ts - b.Ts);

// Fixture metadata reconstructed from the score events plus the spike
// findings (France is Participant1, final 2-0).
const first = scores.find((e) => e.StartTime && e.Participant1Id);
const fixture = {
  FixtureId: FIXTURE_ID,
  StartTime: first.StartTime,
  Competition: "World Cup",
  CompetitionId: first.CompetitionId,
  Participant1Id: first.Participant1Id,
  Participant1: "France",
  Participant2Id: first.Participant2Id,
  Participant2: "Morocco",
  Participant1IsHome: first.Participant1IsHome,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "scores.json"), JSON.stringify(scores));
fs.writeFileSync(path.join(OUT_DIR, "odds-1x2.json"), JSON.stringify(ft1x2));
fs.writeFileSync(path.join(OUT_DIR, "fixture.json"), JSON.stringify(fixture, null, 2));

console.log(`[bundle] ${scores.length} score events -> data/replay/${FIXTURE_ID}/scores.json`);
console.log(`[bundle] ${ft1x2.length} FT 1X2 odds (of ${odds.length} total) -> data/replay/${FIXTURE_ID}/odds-1x2.json`);
console.log(`[bundle] fixture metadata -> data/replay/${FIXTURE_ID}/fixture.json`);
