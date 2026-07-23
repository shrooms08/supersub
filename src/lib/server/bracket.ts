// The knockout bracket: the World Cup's knockout tree, Round of 32 through
// the Final, plus the champion. Read-only.
//
// WHAT THE FEED GIVES US, AND WHAT IT DOES NOT (see the bracket
// investigation in docs): a fixture carries a numeric FixtureGroupId that
// partitions the tournament into stages, but it carries NO stage name, no
// round name, and no group letter. The FixtureGroupId number is opaque and
// its order does not match round order, so we never read a name from it.
//
// Stage identity is INFERRED from fixture counts and dates, which are
// unambiguous for a single-elimination knockout:
//   16 fixtures -> Round of 32   (32 teams)
//    8 fixtures -> Round of 16
//    4 fixtures -> Quarter-finals
//    2 fixtures -> Semi-finals
//    1 fixture  -> Final (the latest) or Third-place playoff (the earlier)
// The group stage is the one remaining stage with far more fixtures than any
// knockout round (48 teams, ~74 fixtures); it is NOT a knockout round and is
// surfaced only as a count that links to the Results tab. We do not invent
// group letters, because the feed does not expose them (all group-stage
// fixtures share one FixtureGroupId, and they do not even partition cleanly
// into twelve groups).
//
// EXTENSION POINT (future group half): if a static group-mapping file is
// ever added (fixtureId -> "Group A".."Group L"), it slots in at
// classifyStages() below, where the group-stage fixtures are already
// isolated as their own stage. A mapping would turn that one stage into
// twelve labelled mini-tables WITHOUT changing the knockout tree or any of
// the round/champion logic here. Nothing downstream assumes the group stage
// is unstructured; it just has no labels yet.
//
// Performance: canonical scores come from the shared cachedScore path (the
// SMOKE9 game_finalised Score map), never from folding event logs, and the
// bracket structure itself is cached for ~10 minutes.

import { normalizeFixture } from "@/lib/feed/normalize";
import type { Fixture } from "@/lib/feed/types";
import { epochDay, txGetJson } from "@/lib/server/txline";
import { reportAvailable } from "@/lib/server/match-timeline";
import { cachedScore } from "@/lib/server/results";
import { isWorldCup } from "@/lib/worldcup";

const TOURNAMENT_LOOKBACK_DAYS = 45;
const STRUCTURE_TTL_MS = 10 * 60_000;

// Knockout stages in tree order. THIRD is a sidecar, not on the path to the
// champion, so it is carried separately from the spine.
export type Stage = "R32" | "R16" | "QF" | "SF" | "THIRD" | "FINAL";

// Fixture count -> knockout stage. The single-fixture stages (Final and
// Third place) share a count and are told apart by date, so they are not in
// this map.
const COUNT_TO_STAGE: Record<number, Stage> = {
  16: "R32",
  8: "R16",
  4: "QF",
  2: "SF",
};

const STAGE_NAME: Record<Stage, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-finals",
  SF: "Semi-finals",
  THIRD: "Third-place playoff",
  FINAL: "Final",
};

// Display order of the spine (Third place is rendered separately).
const SPINE: Stage[] = ["R32", "R16", "QF", "SF", "FINAL"];

export interface BracketFixture {
  fixtureId: number;
  participant1: string;
  participant2: string;
  participant1IsHome: boolean;
  startTime: number;
  score: { p1: number; p2: number } | null;
  pens: { p1: number; p2: number } | null;
  scoreless: boolean;
  hasReport: boolean;
  // 1 or 2 when a canonical result exists, else null (never assumed).
  winner: 1 | 2 | null;
}

export interface BracketRound {
  stage: Stage;
  name: string; // inferred from fixture count, not read from the feed
  fixtures: BracketFixture[];
}

export interface BracketPayload {
  rounds: BracketRound[]; // the spine: R32 -> Final, in order
  thirdPlace: BracketFixture | null;
  champion: { team: string; fixtureId: number } | null;
  // The group stage is not a knockout round; we only report how many
  // fixtures it holds so the view can link to Results honestly.
  groupStageCount: number;
  error: string | null;
}

function winnerOf(score: { p1: number; p2: number } | null, pens: { p1: number; p2: number } | null): 1 | 2 | null {
  if (!score) return null;
  if (score.p1 !== score.p2) return score.p1 > score.p2 ? 1 : 2;
  if (pens && pens.p1 !== pens.p2) return pens.p1 > pens.p2 ? 1 : 2;
  return null; // level with no shootout resolution: do not assume a winner
}

// ---- stage classification (inferred, not read from the feed) --------------

interface StageGroup {
  stage: Stage | "GROUP";
  fixtures: Fixture[];
}

// Partition WC fixtures by FixtureGroupId, then name each partition from its
// size and date. The largest partition is the group stage; the rest are
// knockout rounds. The extension point (a future group-mapping file) would
// consume the "GROUP" partition below without touching anything else.
function classifyStages(fixtures: Fixture[]): StageGroup[] {
  const byGroupId = new Map<number, Fixture[]>();
  for (const f of fixtures) {
    const id = f.competitionGroupId;
    if (id === undefined) continue;
    const list = byGroupId.get(id) ?? [];
    list.push(f);
    byGroupId.set(id, list);
  }

  const partitions = [...byGroupId.values()];
  if (partitions.length === 0) return [];

  // The group stage is the partition with the most fixtures (48 teams dwarf
  // any knockout round). Everything else is a knockout round.
  const groupStage = partitions.reduce((a, b) => (b.length > a.length ? b : a));

  // Single-fixture partitions are the Final and the Third-place playoff,
  // told apart by kickoff: the Final is last.
  const singles = partitions
    .filter((p) => p !== groupStage && p.length === 1)
    .sort((a, b) => a[0].startTime - b[0].startTime);
  const finalPartition = singles.length ? singles[singles.length - 1] : null;
  const thirdPartition = singles.length > 1 ? singles[0] : null;

  const out: StageGroup[] = [];
  for (const p of partitions) {
    if (p === groupStage) {
      out.push({ stage: "GROUP", fixtures: p });
    } else if (p === finalPartition) {
      out.push({ stage: "FINAL", fixtures: p });
    } else if (p === thirdPartition) {
      out.push({ stage: "THIRD", fixtures: p });
    } else {
      const stage = COUNT_TO_STAGE[p.length];
      // A knockout round whose size is not a recognised power of two is not
      // something we will guess a name for; it is dropped rather than
      // mislabelled.
      if (stage) out.push({ stage, fixtures: p });
    }
  }
  return out;
}

// ---- structure cache (metadata only, no scores) ---------------------------

let structureCache: { at: number; groups: StageGroup[]; error: string | null } | null = null;

async function fetchStructure(now: number): Promise<{ groups: StageGroup[]; error: string | null }> {
  if (structureCache && now - structureCache.at < STRUCTURE_TTL_MS) {
    return { groups: structureCache.groups, error: structureCache.error };
  }
  let raw: unknown[];
  try {
    raw = await txGetJson<unknown[]>(
      `/fixtures/snapshot?startEpochDay=${epochDay(now) - TOURNAMENT_LOOKBACK_DAYS}`
    );
  } catch (err) {
    return { groups: [], error: err instanceof Error ? err.message : String(err) };
  }
  const fixtures = raw
    .map(normalizeFixture)
    .filter((f): f is Fixture => f !== null)
    .filter(isWorldCup);
  const groups = classifyStages(fixtures);
  structureCache = { at: now, groups, error: null };
  return { groups, error: null };
}

// ---- assembly -------------------------------------------------------------

async function toBracketFixture(f: Fixture): Promise<BracketFixture> {
  const s = await cachedScore(f.fixtureId);
  return {
    fixtureId: f.fixtureId,
    participant1: f.participant1,
    participant2: f.participant2,
    participant1IsHome: f.participant1IsHome,
    startTime: f.startTime,
    score: s.score,
    pens: s.pens,
    scoreless: s.scoreless,
    hasReport: reportAvailable(f.fixtureId, s.score !== null),
    winner: winnerOf(s.score, s.pens),
  };
}

export async function getBracket(now: number): Promise<BracketPayload> {
  const { groups, error } = await fetchStructure(now);
  if (error) {
    return { rounds: [], thirdPlace: null, champion: null, groupStageCount: 0, error };
  }

  const groupStageCount = groups.find((g) => g.stage === "GROUP")?.fixtures.length ?? 0;

  // Score every knockout fixture in parallel (group stage is not in the tree
  // and is never scored here). Each canonical score is cached and shared
  // with the Results wall.
  const knockout = groups.filter((g) => g.stage !== "GROUP");
  const byStage = new Map<Stage, BracketFixture[]>();
  await Promise.all(
    knockout.map(async (g) => {
      const built = await Promise.all(
        [...g.fixtures].sort((a, b) => a.startTime - b.startTime).map(toBracketFixture)
      );
      byStage.set(g.stage as Stage, built);
    })
  );

  const rounds: BracketRound[] = SPINE.filter((s) => byStage.has(s)).map((stage) => ({
    stage,
    name: STAGE_NAME[stage],
    fixtures: byStage.get(stage)!,
  }));

  const thirdList = byStage.get("THIRD");
  const thirdPlace = thirdList && thirdList.length ? thirdList[0] : null;

  // Champion: the winner of the single Final fixture, from its canonical
  // score alone. No score, no crown.
  const finalFixture = byStage.get("FINAL")?.[0] ?? null;
  let champion: BracketPayload["champion"] = null;
  if (finalFixture && finalFixture.winner) {
    champion = {
      team: finalFixture.winner === 1 ? finalFixture.participant1 : finalFixture.participant2,
      fixtureId: finalFixture.fixtureId,
    };
  }

  return { rounds, thirdPlace, champion, groupStageCount, error: null };
}

// ---- the mirrored tree ----------------------------------------------------
//
// The bracket-v2 view is a mirrored tree: two halves of the draw converging
// on the Final. The halves are NOT guessed - they are threaded backward from
// the Final by team identity, which is deterministic from the results we
// already have:
//
//   - The Final's two participants are the two finalists. Each finalist's
//     side of the draw is the sub-tree that fed their Semi-final.
//   - A match in round r+1 has two participants; each is the WINNER of
//     exactly one match in round r. So each match's two feeder matches are
//     found by name: the round-r match whose winner is participant1, and the
//     round-r match whose winner is participant2.
//   - Recurse from each Semi-final down to the Round of 32; the Round of 32
//     matches are the leaves.
//
// If any feeder cannot be found uniquely (a missing or ambiguous winner),
// that fixture is recorded in `unplaceable` and the caller MUST NOT render a
// guessed tree - it reports and stops.

export interface BracketNode {
  match: BracketFixture;
  // Feeder matches (round r-1), participant1's side first. null at the
  // Round of 32 (the leaves).
  children: [BracketNode, BracketNode] | null;
}

export interface BracketTree {
  // The two halves of the draw. left is the Final's participant1 side,
  // right is the participant2 side. Each is the sub-tree rooted at that
  // finalist's Semi-final. Null only when the tree could not be built.
  left: BracketNode | null;
  right: BracketNode | null;
  final: BracketFixture | null;
  thirdPlace: BracketFixture | null;
  champion: { team: string; fixtureId: number } | null;
  groupStageCount: number;
  // The stage names, mirrored on each half (Round of 32 -> Semi-finals),
  // outermost first. Handy for the column headers.
  roundNames: string[];
  // Fixtures that could not be placed deterministically. When non-empty the
  // view must refuse to draw a tree rather than guess.
  unplaceable: string[];
  error: string | null;
}

function nameOfWinner(f: BracketFixture): string | null {
  if (f.winner === 1) return f.participant1;
  if (f.winner === 2) return f.participant2;
  return null;
}

// The one round-r match whose winner is `team`, or null if not exactly one.
function feederFor(team: string, roundFixtures: BracketFixture[]): BracketFixture | null {
  const hits = roundFixtures.filter((f) => nameOfWinner(f) === team);
  return hits.length === 1 ? hits[0] : null;
}

export function buildBracketTree(payload: BracketPayload): BracketTree {
  const base: Omit<BracketTree, "left" | "right"> = {
    final: null,
    thirdPlace: payload.thirdPlace,
    champion: payload.champion,
    groupStageCount: payload.groupStageCount,
    roundNames: [],
    unplaceable: [],
    error: payload.error,
  };
  if (payload.error) return { ...base, left: null, right: null };

  // Index the spine by stage. Threading needs every knockout round present.
  const byStage = new Map<Stage, BracketFixture[]>();
  for (const r of payload.rounds) byStage.set(r.stage, r.fixtures);
  const order: Stage[] = ["R32", "R16", "QF", "SF"];
  const missing = order.find((s) => !byStage.has(s));
  const finalFixture = byStage.get("FINAL")?.[0] ?? null;
  if (missing || !finalFixture) {
    return {
      ...base,
      left: null,
      right: null,
      error: `bracket tree needs every knockout round; missing ${missing ?? "FINAL"}`,
    };
  }

  const unplaceable: string[] = [];
  const label = (f: BracketFixture) => `${f.participant1} v ${f.participant2}`;

  // Build a sub-tree for `match`, sitting at round index `idx` (0=R32 leaf).
  function build(match: BracketFixture, idx: number): BracketNode {
    if (idx === 0) return { match, children: null }; // Round of 32: a leaf
    const prev = byStage.get(order[idx - 1])!;
    const a = feederFor(match.participant1, prev);
    const b = feederFor(match.participant2, prev);
    if (!a || !b) {
      unplaceable.push(label(match));
      return { match, children: null };
    }
    return { match, children: [build(a, idx - 1), build(b, idx - 1)] };
  }

  // The two Semi-finals: the one each finalist won. participant1 is the left
  // half, participant2 the right. (The Final need not have a winner for the
  // halves to be known - the finalists are its two participants.)
  const sf = byStage.get("SF")!;
  const leftSf = feederFor(finalFixture.participant1, sf);
  const rightSf = feederFor(finalFixture.participant2, sf);
  if (!leftSf || !rightSf) {
    unplaceable.push(`Final ${label(finalFixture)} (semi-final feeders)`);
    return { ...base, left: null, right: null, final: finalFixture, unplaceable };
  }

  const SF_IDX = 3; // R32=0, R16=1, QF=2, SF=3
  const left = build(leftSf, SF_IDX);
  const right = build(rightSf, SF_IDX);

  // Mirrored column headers, outermost (Round of 32) first.
  const roundNames = [STAGE_NAME.R32, STAGE_NAME.R16, STAGE_NAME.QF, STAGE_NAME.SF];

  return { ...base, left, right, final: finalFixture, roundNames, unplaceable };
}

export async function getBracketTree(now: number): Promise<BracketTree> {
  const payload = await getBracket(now);
  return buildBracketTree(payload);
}
