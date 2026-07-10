"use client";

// The centerpiece: the chosen team's win probability from kickoff to now,
// redrawn as ticks arrive (the stream flushes up to ~8 times a second, so
// the line visibly moves within seconds of feed updates). Suspended
// stretches (market off the board around goals and VAR) render dimmed and
// dashed instead of interpolating.

import { useMemo } from "react";
import type { ProbTick } from "@/lib/feed/types";
import { teamProb } from "@/lib/state/winprob";

const W = 1000;
const H = 400;
const PAD_Y = 10;

function yFor(p: number): number {
  return PAD_Y + (1 - p) * (H - 2 * PAD_Y);
}

export interface EntryMark {
  ts: number;
  prob: number;
  minute: number;
}

export function WinProbChart({
  series,
  team,
  kickoffTs,
  feedNow,
  entry,
}: {
  series: ProbTick[];
  team: 1 | 2;
  kickoffTs: number;
  feedNow: number;
  entry: EntryMark | null;
}) {
  const x1 = Math.max(feedNow, kickoffTs + 10 * 60_000);
  const x0 = kickoffTs;
  const xFor = (ts: number) => ((ts - x0) / (x1 - x0)) * W;

  const { segments, last } = useMemo(() => {
    const visible = series.filter((t) => t.ts >= x0 - 60_000 && t.ts <= feedNow);
    // Downsample long series but always keep the newest point.
    const stride = Math.max(1, Math.floor(visible.length / 600));
    const pts = visible.filter((_, i) => i % stride === 0);
    if (visible.length > 0 && pts[pts.length - 1] !== visible[visible.length - 1]) {
      pts.push(visible[visible.length - 1]);
    }

    // Split into solid (tradable) and dashed (suspended) segments.
    const segs: { suspended: boolean; d: string }[] = [];
    let cur: { suspended: boolean; coords: string[] } | null = null;
    let prev: ProbTick | null = null;
    for (const t of pts) {
      const x = Math.max(0, xFor(t.ts));
      const y = yFor(teamProb(t, team));
      if (!cur || cur.suspended !== t.suspended) {
        const carry =
          prev !== null ? [`${Math.max(0, xFor(prev.ts)).toFixed(1)},${yFor(teamProb(prev, team)).toFixed(1)}`] : [];
        cur = { suspended: t.suspended, coords: carry };
        segs.push({ suspended: t.suspended, d: "" });
      }
      cur.coords.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      segs[segs.length - 1].d = `M${cur.coords.join(" L")}`;
      prev = t;
    }
    return { segments: segs, last: pts.length > 0 ? pts[pts.length - 1] : null };
  }, [series, team, x0, x1, feedNow]); // eslint-disable-line react-hooks/exhaustive-deps

  const lastProb = last ? teamProb(last, team) : null;
  const lastX = last ? Math.min(W, xFor(Math.min(last.ts, feedNow))) : null;
  const nowX = Math.min(W, xFor(feedNow));

  // Area fill under the newest segment run, faint volt.
  const areaD = useMemo(() => {
    if (segments.length === 0 || lastProb === null || lastX === null) return null;
    const all = segments.map((s) => s.d.slice(1)).join(" L");
    return `M${all} L${nowX.toFixed(1)},${yFor(lastProb).toFixed(1)} L${nowX.toFixed(1)},${H} L0,${H} Z`;
  }, [segments, lastProb, lastX, nowX]);

  // Elapsed-feed-time gridlines every 30 minutes.
  const xTicks = useMemo(() => {
    const out: { x: number; label: string }[] = [];
    for (let m = 0; m * 60_000 <= x1 - x0; m += 30) {
      out.push({ x: xFor(x0 + m * 60_000), label: `${m}'` });
    }
    return out;
  }, [x0, x1]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-44 w-full sm:h-56"
        role="img"
        aria-label="Win probability from kickoff to now"
      >
        {/* Gridlines: whisper-gray, 25/50/75 */}
        {[0.25, 0.5, 0.75].map((p) => (
          <line
            key={p}
            x1={0}
            x2={W}
            y1={yFor(p)}
            y2={yFor(p)}
            stroke="#26262c"
            strokeWidth={p === 0.5 ? 2 : 1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {xTicks.map((t) => (
          <line
            key={t.label}
            x1={t.x}
            x2={t.x}
            y1={0}
            y2={H}
            stroke="#1b1b20"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {areaD && <path d={areaD} fill="rgba(214, 255, 63, 0.07)" />}

        {segments.map((s, i) => (
          <path
            key={i}
            d={s.d}
            fill="none"
            stroke={s.suspended ? "#9dbf1f" : "#d6ff3f"}
            strokeWidth={s.suspended ? 1.5 : 2.5}
            strokeDasharray={s.suspended ? "6 5" : undefined}
            strokeOpacity={s.suspended ? 0.55 : 1}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* Hold line from the last tick to now */}
        {lastProb !== null && lastX !== null && nowX > lastX && (
          <line
            x1={lastX}
            x2={nowX}
            y1={yFor(lastProb)}
            y2={yFor(lastProb)}
            stroke="#d6ff3f"
            strokeWidth={2.5}
            strokeOpacity={0.5}
            strokeDasharray="2 4"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* Entry marker: pinned on the curve once you are on the pitch */}
        {entry && entry.ts >= x0 && (
          <g>
            <line
              x1={xFor(entry.ts)}
              x2={xFor(entry.ts)}
              y1={0}
              y2={H}
              stroke="#d6ff3f"
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
              stroke="#d6ff3f"
              strokeWidth={3}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )}

        {/* Live dot on the advancing edge */}
        {lastProb !== null && (
          <circle
            cx={nowX}
            cy={yFor(lastProb)}
            r={6}
            fill="#d6ff3f"
            className="animate-live-dot"
          />
        )}
      </svg>

      {/* HTML overlays so text never distorts with preserveAspectRatio none */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {[0.75, 0.5, 0.25].map((p) => (
          <span
            key={p}
            className="absolute right-1 -translate-y-1/2 text-[10px] tabular-nums text-chalk-600"
            style={{ top: `${(yFor(p) / H) * 100}%` }}
          >
            {Math.round(p * 100)}
          </span>
        ))}
        {entry && entry.ts >= x0 && (
          <span
            className="absolute top-1 -translate-x-1/2 rounded-sm bg-pitch-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-volt"
            style={{ left: `${(Math.max(0, Math.min(W, xFor(entry.ts))) / W) * 100}%` }}
          >
            On {entry.minute}&apos;
          </span>
        )}
      </div>

      <div aria-hidden className="mt-1 flex justify-between">
        {xTicks.map((t) => (
          <span key={t.label} className="text-[10px] tabular-nums text-chalk-600">
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}
