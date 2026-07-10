// Demo research: for a bundled fixture, sweep entry minutes for both
// teams and print the win probability, locked multiplier and tier, window
// points, final points, and badges each entry would produce. This is how
// DEMO.md's scenario numbers were derived. Usage:
//   npx tsx scripts/scan-scenarios.ts 18209181 [stepMinutes]

import * as fs from "node:fs";
import * as path from "node:path";
import { normalizeFixture, normalizeMatchEvent, normalizeOddsUpdate, is1x2FullTime } from "../src/lib/feed/normalize";
import { foldMatch, stateMinute } from "../src/lib/state/fold";
import { foldProbSeries, probAt, teamProb } from "../src/lib/state/winprob";
import { multiplierForProb, scoreWindow, finalPoints } from "../src/lib/state/scoring";
import { tierForMultiplier } from "../src/lib/config/scoring";
import { evaluateBadges } from "../src/lib/career/badges";
import type { MatchEvent, OddsUpdate } from "../src/lib/feed/types";

const fixtureId = Number(process.argv[2] ?? 18209181);
const step = Number(process.argv[3] ?? 5);

const base = ["data", ".cache"]
  .map((d) => path.join(process.cwd(), d, "replay", String(fixtureId)))
  .find((p) => fs.existsSync(p));
if (!base) throw new Error(`no replay bundle for ${fixtureId}`);

const fixture = normalizeFixture(JSON.parse(fs.readFileSync(path.join(base, "fixture.json"), "utf8")))!;
const events = (JSON.parse(fs.readFileSync(path.join(base, "scores.json"), "utf8")) as unknown[])
  .map(normalizeMatchEvent)
  .filter((e): e is MatchEvent => e !== null)
  .sort((a, b) => a.seq - b.seq);
const odds = (JSON.parse(fs.readFileSync(path.join(base, "odds-1x2.json"), "utf8")) as unknown[])
  .map(normalizeOddsUpdate)
  .filter((o): o is OddsUpdate => o !== null)
  .filter(is1x2FullTime)
  .sort((a, b) => a.ts - b.ts);

const finalState = foldMatch(events);
const series = foldProbSeries(odds);
const kickoff = finalState.kickoffTs!;
const lastEventTs = events[events.length - 1].ts;

console.log(
  `${fixture.participant1} v ${fixture.participant2} (${fixtureId}): final ${finalState.score.p1}-${finalState.score.p2}, ` +
    `kickoff feed ts ${kickoff}, ${series.length} prob ticks`
);
console.log(
  `goals: ${finalState.countables
    .filter((c) => c.kind === "goal")
    .map((c) => `${c.participant === 1 ? fixture.participant1 : fixture.participant2} ${Math.floor(c.clockSeconds / 60) + 1}'${c.discarded ? " (VAR erased)" : ""}`)
    .join(", ")}`
);
console.log("");
console.log("team              entry  P(win)  mult   tier               window  final   badges");

for (const team of [1, 2] as const) {
  const name = team === 1 ? fixture.participant1 : fixture.participant2;
  for (let minute = 0; minute <= 95; minute += step) {
    const entryTs = kickoff + minute * 60_000;
    if (entryTs >= lastEventTs) break;
    const upTo = events.filter((e) => e.ts <= entryTs);
    const stateAtEntry = foldMatch(upTo, { feedNow: entryTs });
    if (stateAtEntry.phase !== "live") continue;
    const tick = probAt(series, entryTs);
    if (!tick) continue;
    const p = teamProb(tick, team);
    const mult = multiplierForProb(p);
    const scoreTeam = team === 1 ? stateAtEntry.score.p1 : stateAtEntry.score.p2;
    const scoreOpp = team === 1 ? stateAtEntry.score.p2 : stateAtEntry.score.p1;
    const window = scoreWindow(
      { team, entryFeedTs: entryTs, scoreTeamAtEntry: scoreTeam, scoreOppAtEntry: scoreOpp },
      finalState
    );
    const points = finalPoints(window.windowPoints, mult);
    const badges = evaluateBadges(
      {
        entry_minute: stateMinute(stateAtEntry, entryTs),
        win_prob_at_entry: p,
        score_team_at_entry: scoreTeam,
        score_opp_at_entry: scoreOpp,
        final_score_team: window.finalScoreTeam,
        final_score_opp: window.finalScoreOpp,
        breakdown: window.breakdown,
      },
      2 // ignore appearance-count badges in the sweep
    ).filter((b) => b !== "first_whistle" && b !== "ever_present");
    console.log(
      `${name.padEnd(16)} ${String(stateMinute(stateAtEntry, entryTs)).padStart(3)}'  ` +
        `${(100 * p).toFixed(1).padStart(5)}%  ${mult.toFixed(2)}x  ${tierForMultiplier(mult).name.padEnd(17)} ` +
        `${String(window.windowPoints).padStart(5)}  ${String(points).padStart(6)}  ${badges.join(",")}`
    );
  }
  console.log("");
}
