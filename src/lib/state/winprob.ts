// Win probability time series (binding architecture requirement 5).
//
// Source market: full-time 1X2 on the TXLineStablePriceDemargined
// consensus book. Preference order per tick:
//   1. the feed's own demargined Pct percentages when present and numeric
//   2. normalized inverse odds from Prices (removes the overround)
// Records with empty Prices/Pct mean the market is suspended (observed
// around goals and VAR): the series holds the last tradable value and
// flags the tick as suspended.
//
// The series is keyed by feed timestamps (OddsUpdate.ts), never by arrival
// wall clock.

import { is1x2FullTime } from "@/lib/feed/normalize";
import type { OddsUpdate, ProbTick } from "@/lib/feed/types";

function fromPct(o: OddsUpdate): { p1: number; draw: number; p2: number } | null {
  if (o.pct.length < 3 || o.priceNames.length < 3) return null;
  const at = (name: string) => {
    const i = o.priceNames.indexOf(name);
    if (i < 0) return NaN;
    return Number.parseFloat(o.pct[i]);
  };
  const p1 = at("part1");
  const draw = at("draw");
  const p2 = at("part2");
  if ([p1, draw, p2].some((v) => !Number.isFinite(v))) return null;
  return { p1: p1 / 100, draw: draw / 100, p2: p2 / 100 };
}

function fromPrices(o: OddsUpdate): { p1: number; draw: number; p2: number } | null {
  if (o.prices.length < 3 || o.priceNames.length < 3) return null;
  const at = (name: string) => {
    const i = o.priceNames.indexOf(name);
    return i >= 0 ? o.prices[i] : 0;
  };
  const prices = [at("part1"), at("draw"), at("part2")];
  if (prices.some((p) => !p || p <= 0)) return null;
  const inv = prices.map((p) => 1000 / p);
  const sum = inv[0] + inv[1] + inv[2];
  return { p1: inv[0] / sum, draw: inv[1] / sum, p2: inv[2] / sum };
}

// Fold a raw odds log into the probability series. Pure function of the
// ordered odds log, same philosophy as the match state fold.
export function foldProbSeries(odds: OddsUpdate[]): ProbTick[] {
  const ft = odds.filter(is1x2FullTime).sort((a, b) => a.ts - b.ts);
  const out: ProbTick[] = [];
  let last: { p1: number; draw: number; p2: number } | null = null;

  for (const o of ft) {
    const value = fromPct(o) ?? fromPrices(o);
    if (value) {
      last = value;
      out.push({ ts: o.ts, ...value, suspended: false });
    } else if (last) {
      // Suspended market: hold the last tradable value.
      out.push({ ts: o.ts, ...last, suspended: true });
    }
  }
  return out;
}

// Latest tick at or before a feed timestamp.
export function probAt(series: ProbTick[], ts: number): ProbTick | null {
  let best: ProbTick | null = null;
  for (const tick of series) {
    if (tick.ts > ts) break;
    best = tick;
  }
  return best;
}

export function teamProb(tick: ProbTick, team: 1 | 2): number {
  return team === 1 ? tick.p1 : tick.p2;
}
