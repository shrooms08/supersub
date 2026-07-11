"use client";

// The centerpiece: the chosen team's win probability from kickoff to now.
// Geometry and motion ported from the canonical reference
// (docs/design/SuperSub.dc.html buildCurve()): 680x236 space, smooth
// bezier through the points with Catmull-Rom control math
// (c1 = p1 + (p2 - p0)/6, c2 = p2 - (p3 - p1)/6), gradient area fill,
// minute ticks, curveDraw on mount, markerDrop on the entry tag.
//
// One deliberate divergence from the mock, kept for honesty: stretches
// where the market is suspended (prices pulled around goals and VAR)
// render as dimmed dashes instead of pretending the line is tradable.

import { useEffect, useMemo, useState } from "react";
import type { ProbTick } from "@/lib/feed/types";
import { teamProb } from "@/lib/state/winprob";

const W = 680;
const H = 236;
const FLOOR = H - 18;
const TOP = 8;

function yFor(p: number): number {
  return TOP + (1 - p) * (FLOOR - TOP);
}

interface Pt {
  x: number;
  y: number;
  suspended: boolean;
}

// Catmull-Rom to cubic bezier, exactly as the reference builds it.
function bezierPath(pts: Pt[]): string {
  if (pts.length === 0) return "";
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export interface EntryMark {
  ts: number;
  prob: number;
  minute: number;
  shirtNumber?: number;
}

const Y25 = () => yFor(0.25);

export function WinProbChart({
  series,
  team,
  kickoffTs,
  feedNow,
  entry,
  nowMinute,
}: {
  series: ProbTick[];
  team: 1 | 2;
  kickoffTs: number;
  feedNow: number;
  entry: EntryMark | null;
  // Derived match minute for the NOW marker before entry.
  nowMinute?: number;
}) {
  const x1 = Math.max(feedNow, kickoffTs + 10 * 60_000);
  const x0 = kickoffTs;
  const xFor = (ts: number) => ((ts - x0) / (x1 - x0)) * W;

  // curveDraw runs once on mount, then the dasharray comes off so live
  // updates redraw without re-animating.
  const [drawing, setDrawing] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setDrawing(false), 1_900);
    return () => window.clearTimeout(t);
  }, []);

  const { solidD, suspendedDs, last } = useMemo(() => {
    const visible = series.filter((t) => t.ts >= x0 - 60_000 && t.ts <= feedNow);
    const stride = Math.max(1, Math.floor(visible.length / 200));
    const sampled = visible.filter((_, i) => i % stride === 0);
    if (visible.length > 0 && sampled[sampled.length - 1] !== visible[visible.length - 1]) {
      sampled.push(visible[visible.length - 1]);
    }
    const pts: Pt[] = sampled.map((t) => ({
      x: Math.max(0, xFor(t.ts)),
      y: yFor(teamProb(t, team)),
      suspended: t.suspended,
    }));

    // One smooth path for the whole line; suspended stretches overlaid as
    // dashed straight runs so the honesty marker survives the bezier.
    const runs: Pt[][] = [];
    let current: Pt[] | null = null;
    for (let i = 0; i < pts.length; i++) {
      if (pts[i].suspended) {
        if (!current) {
          current = i > 0 ? [pts[i - 1]] : [];
          runs.push(current);
        }
        current.push(pts[i]);
      } else if (current) {
        current.push(pts[i]);
        current = null;
      }
    }
    return {
      solidD: bezierPath(pts),
      suspendedDs: runs
        .filter((r) => r.length > 1)
        .map((r) => `M ${r.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L ")}`),
      last: pts.length > 0 ? pts[pts.length - 1] : null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, team, x0, x1, feedNow]);

  const nowX = Math.min(W, xFor(feedNow));
  const areaD = useMemo(() => {
    if (!solidD || !last) return null;
    return `${solidD} L ${nowX.toFixed(1)} ${last.y.toFixed(1)} L ${nowX.toFixed(1)} ${FLOOR} L 0 ${FLOOR} Z`;
  }, [solidD, last, nowX]);

  // Minute ticks every 15 feed-minutes across the visible domain.
  const ticks = useMemo(() => {
    const out: { x: number; label: string }[] = [];
    for (let m = 15; m * 60_000 <= x1 - x0; m += 15) {
      out.push({ x: (m * 60_000 * W) / (x1 - x0), label: `${m}'` });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x0, x1]);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-44 w-full sm:h-56"
        role="img"
        aria-label="Win probability from kickoff to now"
      >
        <defs>
          <linearGradient id="prob-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(200, 255, 0, 0.24)" />
            <stop offset="55%" stopColor="rgba(200, 255, 0, 0.07)" />
            <stop offset="100%" stopColor="rgba(200, 255, 0, 0)" />
          </linearGradient>
        </defs>

        {/* Miracle territory: the band below 25 percent */}
        <rect x={0} y={Y25()} width={W} height={FLOOR - Y25()} fill="rgba(255,255,255,0.028)" />
        <line
          x1={0}
          x2={W}
          y1={Y25()}
          y2={Y25()}
          stroke="#3a3a42"
          strokeWidth={1}
          strokeDasharray="4 5"
          vectorEffect="non-scaling-stroke"
        />
        {[0.5, 0.75].map((p) => (
          <line
            key={p}
            x1={0}
            x2={W}
            y1={yFor(p)}
            y2={yFor(p)}
            stroke="#26262c"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {ticks.map((t) => (
          <line
            key={t.label}
            x1={t.x}
            x2={t.x}
            y1={0}
            y2={H}
            stroke="#1a1a1f"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {areaD && !drawing && <path d={areaD} fill="url(#prob-area)" />}

        {solidD && (
          <path
            d={solidD}
            fill="none"
            stroke="#c8ff00"
            strokeWidth={2.6}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ filter: "drop-shadow(0 0 6px rgba(200,255,0,.55))" }}
            pathLength={drawing ? 1400 : undefined}
            strokeDasharray={drawing ? 1400 : undefined}
            className={drawing ? "animate-curve-draw" : undefined}
          />
        )}
        {!drawing &&
          suspendedDs.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="#070708"
              strokeWidth={4}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        {!drawing &&
          suspendedDs.map((d, i) => (
            <path
              key={`dash-${i}`}
              d={d}
              fill="none"
              stroke="#9ec400"
              strokeWidth={1.5}
              strokeDasharray="6 5"
              strokeOpacity={0.6}
              vectorEffect="non-scaling-stroke"
            />
          ))}

        {last && nowX > last.x && (
          <line
            x1={last.x}
            x2={nowX}
            y1={last.y}
            y2={last.y}
            stroke="#c8ff00"
            strokeWidth={2.5}
            strokeOpacity={0.5}
            strokeDasharray="2 4"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {entry && entry.ts >= x0 && (
          <g>
            <line
              x1={xFor(entry.ts)}
              x2={xFor(entry.ts)}
              y1={0}
              y2={H}
              stroke="#c8ff00"
              strokeWidth={1.5}
              strokeOpacity={0.7}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={xFor(entry.ts)}
              cy={yFor(entry.prob)}
              r={7}
              fill="#070708"
              stroke="#c8ff00"
              strokeWidth={3}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )}

        {!entry && (
          <line
            x1={nowX}
            x2={nowX}
            y1={0}
            y2={FLOOR}
            stroke="#52525b"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {last && (
          <circle cx={nowX} cy={last.y} r={6} fill="#c8ff00" className="animate-live-pulse" />
        )}
      </svg>

      {/* HTML overlays so text never distorts with preserveAspectRatio none */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {[0.75, 0.5].map((p) => (
          <span
            key={p}
            className="absolute right-1 -translate-y-1/2 font-display text-[10px] font-semibold tabular-nums text-chalk-600"
            style={{ top: `${(yFor(p) / H) * 100}%` }}
          >
            {Math.round(p * 100)}
          </span>
        ))}
        <span
          className="absolute right-2 font-label text-[8px] font-bold uppercase tracking-[0.16em] text-chalk-500"
          style={{ top: `calc(${(Y25() / H) * 100}% + 4px)` }}
        >
          &#9666; Miracle territory
        </span>
        {!entry && (
          <span
            className="absolute top-0 flex -translate-x-1/2 items-center rounded-[4px] bg-pitch-900 px-1.5 py-0.5 font-label text-[8px] font-bold uppercase tracking-[0.14em] text-chalk-500"
            style={{ left: `${(nowX / W) * 100}%` }}
          >
            Now{nowMinute !== undefined ? ` ${nowMinute}'` : ""}
          </span>
        )}
        {entry && entry.ts >= x0 && (
          <span
            className="animate-marker-drop absolute top-1 flex -translate-x-1/2 items-center gap-1 rounded-sm border border-volt/40 bg-pitch-900 px-1.5 py-0.5 font-label text-[10px] font-bold uppercase tracking-widest text-volt"
            style={{ left: `${(Math.max(0, Math.min(W, xFor(entry.ts))) / W) * 100}%` }}
          >
            {entry.shirtNumber !== undefined && (
              <span className="hero-number text-xs leading-none">{entry.shirtNumber}</span>
            )}
            On {entry.minute}&apos;
          </span>
        )}
      </div>

      <div aria-hidden className="relative mt-1 h-4 w-full">
        {ticks.map((t) => (
          <span
            key={t.label}
            className="absolute -translate-x-1/2 font-display text-[10px] font-semibold tabular-nums text-chalk-600"
            style={{ left: `${(t.x / W) * 100}%` }}
          >
            {t.label}
          </span>
        ))}
      </div>

      <div className="mt-1.5 flex items-center gap-4 border-t border-white/5 pt-2">
        <span className="flex items-center gap-1.5 font-label text-[9px] font-semibold uppercase tracking-[0.1em] text-chalk-400">
          <span aria-hidden className="h-[3px] w-3.5 rounded-[2px] bg-volt" />
          Win probability
        </span>
        <span className="flex items-center gap-1.5 font-label text-[9px] font-semibold uppercase tracking-[0.1em] text-chalk-500">
          <span aria-hidden className="w-3 border-t-2 border-dashed border-chalk-600" />
          Entry minute
        </span>
        <span className="ml-auto hidden font-label text-[9px] font-semibold uppercase tracking-[0.1em] text-chalk-600 sm:inline">
          Lower the odds &rarr; higher the reward
        </span>
      </div>
    </div>
  );
}
