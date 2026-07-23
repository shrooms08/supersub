// The knockout bracket view: /bracket. Server-rendered from the cached
// bracket structure; read-only, no entry paths.
//
// v2 is a MIRRORED tournament tree. Two halves of the draw converge on a
// centred Final with the champion above it. The halves are threaded
// backward from the Final by team identity (see buildBracketTree in
// bracket.ts) - deterministic from results we already have, never guessed.
// If any fixture cannot be placed, the tree is refused rather than faked.
//
// Layout:
//   - Desktop (lg+): an absolutely-positioned canvas. Every node's (x, y)
//     is computed from the tree - leaves (Round of 32) get evenly spaced
//     slots, each parent sits at the mean of its two children - so SVG
//     connector elbows and the cards share one coordinate system and align
//     exactly. The left half flows left to right, the right half mirrors it
//     right to left, meeting at the Final. The champion's road to the title
//     is drawn in volt.
//   - Mobile (<lg): a mirrored tree cannot exist at 390px, so we KEEP the
//     v1 vertical stacked-rounds layout (sticky round headers, cards read
//     top to bottom) and add the champion as a hero at the very top. The
//     divergence is deliberate and documented here.

import Link from "next/link";
import {
  getBracket,
  buildBracketTree,
  type BracketFixture,
  type BracketNode,
} from "@/lib/server/bracket";
import { flagFor } from "@/lib/flags";
import { teamCode } from "@/lib/teams";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---- shared card pieces ---------------------------------------------------

function pensLine(f: BracketFixture): string | null {
  if (!f.pens || f.pens.p1 === f.pens.p2) return null;
  const w = f.pens.p1 > f.pens.p2 ? f.participant1 : f.participant2;
  return `${teamCode(w)} pens ${Math.max(f.pens.p1, f.pens.p2)}-${Math.min(f.pens.p1, f.pens.p2)}`;
}

function kickoff(ts: number): string {
  return new Date(ts)
    .toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
    .toUpperCase();
}

function TeamRow({ name, score, isWinner, decided }: { name: string; score: number | null; isWinner: boolean; decided: boolean }) {
  const tone = !decided ? "text-chalk-300" : isWinner ? "text-chalk-50" : "text-chalk-500";
  return (
    <div className={`flex items-center gap-2 ${isWinner ? "font-bold" : ""} ${tone}`}>
      <span aria-hidden className="w-5 shrink-0 text-center text-sm leading-none">
        {flagFor(name) ?? ""}
      </span>
      <span className="min-w-0 flex-1 whitespace-nowrap font-label text-[12px] uppercase tracking-wide">{name}</span>
      <span className="hero-number w-4 text-right text-sm tabular-nums">{score !== null ? score : ""}</span>
    </div>
  );
}

// One match card. `champion` gives it the volt border when it sits on the
// title road.
function MatchCard({ f, now, onPath }: { f: BracketFixture; now: number; onPath: boolean }) {
  const decided = f.winner !== null;
  const upcoming = f.score === null && f.startTime > now;
  const pens = pensLine(f);
  const border = onPath ? "border-volt/60" : "border-pitch-700";

  const body = (
    <div className={`flex h-full flex-col justify-center gap-1 rounded-[11px] border ${border} bg-pitch-850 px-2.5 py-2`}>
      <TeamRow name={f.participant1} score={f.score ? f.score.p1 : null} isWinner={f.winner === 1} decided={decided} />
      <TeamRow name={f.participant2} score={f.score ? f.score.p2 : null} isWinner={f.winner === 2} decided={decided} />
      <div className="flex items-center justify-between gap-2 border-t border-pitch-700 pt-1">
        <span className="whitespace-nowrap font-label text-[9px] font-semibold uppercase tracking-[0.1em] text-chalk-500">
          {upcoming ? kickoff(f.startTime) : pens ? pens : f.score ? "Full time" : "Full time · no score"}
        </span>
        {f.hasReport && (
          <span className="font-label text-[9px] font-bold uppercase tracking-[0.1em] text-volt">Report &rsaquo;</span>
        )}
      </div>
    </div>
  );

  if (f.hasReport) {
    return (
      <Link href={`/match/${f.fixtureId}/report`} className="block h-full rounded-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt">
        {body}
      </Link>
    );
  }
  return body;
}

// ---- desktop layout maths -------------------------------------------------

// Card sized to the longest real country name in the data: "Bosnia &
// Herzegovina" renders 154px at the 12px card font, and a team row is
// padding(10) + flag(20) + gap(8) + name + gap(8) + score(16) + padding(10),
// so ~226px is the floor; 238 leaves a small buffer. The height clears the
// two team rows and the footer from the card border. All tree coordinates
// and connector geometry below are derived from these, so widening the card
// widens the canvas and re-places every elbow automatically.
const CARD_W = 238;
const CARD_H = 84;
const COL_GAP = 38;
const COL_W = CARD_W + COL_GAP;
const ROW_H = 104;
const LEAVES = 8; // per half (16 Round-of-32 matches / 2)
const CANVAS_H = LEAVES * ROW_H; // 704
const CENTER_X = 4 * COL_W - COL_GAP / 2 + 40; // just right of the left half's SF column
const CANVAS_W = CENTER_X + CARD_W + COL_GAP + 4 * COL_W - COL_GAP + 8;
const FINAL_Y = CANVAS_H / 2;

interface Placed {
  f: BracketFixture;
  x: number; // top-left
  y: number; // top-left
  cy: number; // centre y
  onPath: boolean;
}
interface Leg {
  pts: Array<[number, number]>;
  volt: boolean;
}

// Left half: idx 0 (Round of 32) is the OUTER (leftmost) column, idx 3
// (Semi-final) is INNER (nearest the centre). Right half mirrors x.
function xForIdx(idx: number, side: "left" | "right"): number {
  return side === "left" ? idx * COL_W : CANVAS_W - CARD_W - idx * COL_W;
}

// Recursively place a half's sub-tree, appending cards and connector legs.
function layoutHalf(
  root: BracketNode,
  side: "left" | "right",
  onPath: Set<number>,
  cards: Placed[],
  legs: Leg[]
): number {
  let leaf = 0;
  function walk(node: BracketNode, idx: number): number {
    const x = xForIdx(idx, side);
    let cy: number;
    if (!node.children) {
      cy = (leaf + 0.5) * ROW_H;
      leaf += 1;
    } else {
      const ca = walk(node.children[0], idx - 1);
      const cb = walk(node.children[1], idx - 1);
      cy = (ca + cb) / 2;
      // Elbow from the two children (column idx-1) into this node (column idx).
      const childX = xForIdx(idx - 1, side);
      const childOut = side === "left" ? childX + CARD_W : childX; // edge the line leaves from
      const parentIn = side === "left" ? x : x + CARD_W; // edge the line arrives at
      const midX = side === "left" ? childOut + COL_GAP / 2 : childOut - COL_GAP / 2;
      const aVolt = onPath.has(node.children[0].match.fixtureId);
      const bVolt = onPath.has(node.children[1].match.fixtureId);
      const stubVolt = onPath.has(node.match.fixtureId);
      legs.push({ pts: [[childOut, ca], [midX, ca]], volt: aVolt });
      legs.push({ pts: [[childOut, cb], [midX, cb]], volt: bVolt });
      legs.push({ pts: [[midX, ca], [midX, cb]], volt: false });
      legs.push({ pts: [[midX, cy], [parentIn, cy]], volt: stubVolt });
    }
    cards.push({ f: node.match, x, y: cy - CARD_H / 2, cy, onPath: onPath.has(node.match.fixtureId) });
    return cy;
  }
  return walk(root, 3);
}

// The champion's road: the finalist that won, threaded down its own half to
// the Round of 32, plus the Final. Empty when the Final has no result.
function championPath(
  left: BracketNode,
  right: BracketNode,
  final: BracketFixture,
  champTeam: string | null
): Set<number> {
  const ids = new Set<number>();
  if (!champTeam) return ids;
  ids.add(final.fixtureId);
  let node: BracketNode | null = final.participant1 === champTeam ? left : final.participant2 === champTeam ? right : null;
  while (node) {
    ids.add(node.match.fixtureId);
    if (!node.children) break;
    const [a, b] = node.children;
    const inA = a.match.participant1 === champTeam || a.match.participant2 === champTeam;
    node = inA ? a : b;
  }
  return ids;
}

// ---- page -----------------------------------------------------------------

export default async function BracketPage() {
  const now = Date.now();
  const payload = await getBracket(now);
  const tree = buildBracketTree(payload);

  // Refuse to draw a guessed tree: any unplaceable fixture, or a broken
  // structure, falls back to an honest message (requirement 2).
  const canDraw =
    !tree.error && tree.left && tree.right && tree.final && tree.unplaceable.length === 0;

  if (payload.error || (!canDraw && payload.rounds.length === 0)) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center gap-4 px-4 py-10 text-center">
        <p className="hero-number text-2xl uppercase tracking-tight text-chalk-50">Bracket unavailable</p>
        <p className="font-label text-sm text-chalk-400">
          {tree.unplaceable.length > 0
            ? "The knockout draw could not be reconstructed from the feed without guessing, so it is not shown."
            : "The knockout structure is not in the feed right now."}
        </p>
        <Link href="/" className="min-h-[44px] rounded-md border border-chalk-600 px-4 py-2.5 font-label text-sm font-bold uppercase tracking-wide text-chalk-100">
          To the bench
        </Link>
      </main>
    );
  }

  const champBanner = (
    <div className="mx-auto flex w-full max-w-sm items-center gap-3 rounded-[14px] border border-volt/40 bg-volt/10 px-4 py-3.5">
      <span aria-hidden className="text-2xl">{payload.champion ? flagFor(payload.champion.team) ?? "🏆" : "🏆"}</span>
      <div className="flex flex-col">
        <span className="font-label text-[10px] font-bold uppercase tracking-[0.18em] text-volt">Champion</span>
        <span className="hero-number text-xl uppercase tracking-tight text-chalk-50">
          {payload.champion ? payload.champion.team : "To be decided"}
        </span>
      </div>
    </div>
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1760px] flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between gap-2">
        <Link href="/" className="whisper rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-50">
          &lsaquo; The bench
        </Link>
        <p className="font-label text-[10px] font-bold uppercase tracking-[0.18em] text-chalk-500">Knockout bracket</p>
      </header>

      {/* DESKTOP: the mirrored tree. Hidden on mobile. */}
      {canDraw && <DesktopBracket tree={tree} champion={payload.champion} now={now} />}

      {/* MOBILE: vertical stacked rounds with a champion hero on top. */}
      <div className="flex flex-col gap-5 lg:hidden">
        {champBanner}
        {payload.rounds.map((round) => (
          <section key={round.stage} className="flex flex-col gap-3">
            <h2 className="sticky top-0 z-10 -mx-1 bg-pitch-900/90 px-1 py-1 font-label text-[10px] font-bold uppercase tracking-[0.18em] text-chalk-500 backdrop-blur">
              {round.name}
              <span className="ml-1.5 text-chalk-600">{round.fixtures.length}</span>
            </h2>
            <div className="flex flex-col gap-3">
              {round.fixtures.map((f) => (
                <div key={f.fixtureId} className="min-h-[60px]">
                  <MatchCard f={f} now={now} onPath={false} />
                </div>
              ))}
            </div>
          </section>
        ))}
        {payload.thirdPlace && (
          <section className="flex flex-col gap-3">
            <h2 className="font-label text-[10px] font-bold uppercase tracking-[0.18em] text-chalk-500">Third-place playoff</h2>
            <div className="min-h-[60px]">
              <MatchCard f={payload.thirdPlace} now={now} onPath={false} />
            </div>
          </section>
        )}
      </div>

      {/* Group stage: one honest line, no invented structure, both widths. */}
      {payload.groupStageCount > 0 && (
        <section className="rounded-[14px] border border-pitch-700 bg-pitch-850 px-4 py-3.5">
          <h2 className="font-label text-[10px] font-bold uppercase tracking-[0.18em] text-chalk-500">Group stage</h2>
          <p className="mt-1 font-label text-sm text-chalk-300">
            {payload.groupStageCount} group-stage fixtures, listed by matchday in{" "}
            <Link href="/?tab=results" className="font-bold text-volt underline underline-offset-2">Results</Link>.
          </p>
        </section>
      )}
    </main>
  );
}

// Desktop mirrored tree (server-rendered; static coordinates).
function DesktopBracket({
  tree,
  champion,
  now,
}: {
  tree: ReturnType<typeof buildBracketTree>;
  champion: { team: string; fixtureId: number } | null;
  now: number;
}) {
  const left = tree.left!;
  const right = tree.right!;
  const final = tree.final!;
  const onPath = championPath(left, right, final, champion?.team ?? null);

  const cards: Placed[] = [];
  const legs: Leg[] = [];
  const leftSfY = layoutHalf(left, "left", onPath, cards, legs);
  const rightSfY = layoutHalf(right, "right", onPath, cards, legs);

  // The Final sits at the centre; connectors run in from each Semi-final.
  const finalX = CENTER_X;
  const leftSfInX = xForIdx(3, "left") + CARD_W; // right edge of left SF card
  const rightSfInX = xForIdx(3, "right"); // left edge of right SF card
  legs.push({ pts: [[leftSfInX, leftSfY], [finalX, FINAL_Y]], volt: onPath.has(left.match.fixtureId) });
  legs.push({ pts: [[rightSfInX, rightSfY], [finalX + CARD_W, FINAL_Y]], volt: onPath.has(right.match.fixtureId) });

  // Column headers, mirrored. Left: R32..SF outward-in; centre FINAL; right mirror.
  const LABELS = ["Round of 32", "Round of 16", "Quarter-final", "Semi-final"];
  const headers: Array<{ label: string; x: number }> = [];
  for (let idx = 0; idx < 4; idx += 1) {
    headers.push({ label: LABELS[idx], x: xForIdx(idx, "left") });
    headers.push({ label: LABELS[idx], x: xForIdx(idx, "right") });
  }

  return (
    <div className="hidden lg:block lg:overflow-x-auto lg:pb-3">
      <div id="bracket-tree" className="relative mx-auto" style={{ width: CANVAS_W, minWidth: CANVAS_W }}>
        {/* headers */}
        <div className="relative mb-3" style={{ height: 16 }}>
          {headers.map((h, i) => (
            <span
              key={i}
              className="absolute font-label text-[10px] font-bold uppercase tracking-[0.16em] text-chalk-500"
              style={{ left: h.x, width: CARD_W, textAlign: "center" }}
            >
              {h.label}
            </span>
          ))}
          <span
            className="absolute font-label text-[10px] font-bold uppercase tracking-[0.16em] text-volt"
            style={{ left: CENTER_X, width: CARD_W, textAlign: "center" }}
          >
            Final
          </span>
        </div>

        <div className="relative" style={{ width: CANVAS_W, height: CANVAS_H }}>
          {/* connectors under the cards */}
          <svg width={CANVAS_W} height={CANVAS_H} className="absolute inset-0" style={{ pointerEvents: "none" }} aria-hidden>
            {legs.map((leg, i) => (
              <polyline
                key={i}
                points={leg.pts.map(([x, y]) => `${x},${y}`).join(" ")}
                fill="none"
                stroke={leg.volt ? "#c8ff00" : "#26262c"}
                strokeWidth={leg.volt ? 2 : 1.5}
              />
            ))}
          </svg>

          {/* champion hero above the final */}
          <div className="absolute" style={{ left: CENTER_X - 24, top: FINAL_Y - CARD_H / 2 - 110, width: CARD_W + 48 }}>
            <div className="flex flex-col items-center gap-1 rounded-[14px] border border-volt/40 bg-volt/10 px-3 py-3 text-center">
              <span aria-hidden className="text-2xl">{champion ? flagFor(champion.team) ?? "🏆" : "🏆"}</span>
              <span className="font-label text-[9px] font-bold uppercase tracking-[0.18em] text-volt">Champion</span>
              <span className="hero-number text-lg uppercase leading-none tracking-tight text-chalk-50">
                {champion ? champion.team : "TBD"}
              </span>
            </div>
          </div>

          {/* the Final card, centred */}
          <div className="absolute" style={{ left: finalX, top: FINAL_Y - CARD_H / 2, width: CARD_W, height: CARD_H }}>
            <MatchCard f={final} now={now} onPath={Boolean(champion)} />
          </div>

          {/* third-place playoff, small, below the final */}
          {tree.thirdPlace && (
            <div className="absolute" style={{ left: CENTER_X - 24, top: FINAL_Y + CARD_H / 2 + 26, width: CARD_W + 48 }}>
              <p className="mb-1 text-center font-label text-[9px] font-bold uppercase tracking-[0.16em] text-chalk-500">
                Third-place playoff
              </p>
              <div style={{ height: CARD_H }}>
                <MatchCard f={tree.thirdPlace} now={now} onPath={false} />
              </div>
            </div>
          )}

          {/* every match card, absolutely positioned */}
          {cards.map((c) => (
            <div key={c.f.fixtureId} className="absolute" style={{ left: c.x, top: c.y, width: CARD_W, height: CARD_H }}>
              <MatchCard f={c.f} now={now} onPath={c.onPath} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
