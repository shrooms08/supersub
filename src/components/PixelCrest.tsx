// PixelCrest: the deterministic generated club crest. A pure function of
// (seed, number, size): the same seed always renders the same crest, on
// the server or in the browser, and different seeds diverge visibly. No
// network, no canvas, no Math.random; FNV-1a hashes the seed and
// mulberry32 drives every choice from it.

const GRID = 9; // 9x9 cells, mirrored around the center column
const PALETTE_FG = ["#f4f4f5", "#e4e4e7", "#d4d4d8", "#a1a1aa"];
const PALETTE_MID = ["#71717a", "#52525b", "#3a3a42"];
const PALETTE_BG = ["#141418", "#101013", "#1a1a1f"];

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Shield mask: which cells of the 9x9 grid belong to the crest shape.
// Row widths taper toward the point at the bottom.
const ROW_SPAN: Array<[number, number]> = [
  [0, 8],
  [0, 8],
  [0, 8],
  [0, 8],
  [1, 7],
  [1, 7],
  [2, 6],
  [3, 5],
  [4, 4],
];

export interface CrestSpec {
  cells: Array<{ x: number; y: number; color: string }>;
  field: string;
  border: string;
}

export function crestSpec(seed: string, number: string): CrestSpec {
  const rand = mulberry32(fnv1a(`${seed.trim().toLowerCase()}::${number}`) || 1);
  const fg = PALETTE_FG[Math.floor(rand() * PALETTE_FG.length)];
  const mid = PALETTE_MID[Math.floor(rand() * PALETTE_MID.length)];
  const field = PALETTE_BG[Math.floor(rand() * PALETTE_BG.length)];
  const density = 0.38 + rand() * 0.3;

  const cells: CrestSpec["cells"] = [];
  const half = Math.ceil(GRID / 2);
  for (let y = 0; y < GRID; y++) {
    const [lo, hi] = ROW_SPAN[y];
    for (let x = 0; x < half; x++) {
      const mirror = GRID - 1 - x;
      if (x < lo || x > hi) continue;
      const r = rand();
      if (r < density) {
        const color = r < density * 0.55 ? fg : mid;
        cells.push({ x, y, color });
        if (mirror !== x && mirror >= lo && mirror <= hi) {
          cells.push({ x: mirror, y, color });
        }
      }
    }
  }
  // A crest is never blank: pathological seeds get a heart pixel.
  if (cells.length === 0) cells.push({ x: 4, y: 3, color: fg });
  return { cells, field, border: mid };
}

export function PixelCrest({
  seed,
  number,
  size,
  className,
}: {
  seed: string;
  number: string | number;
  size: number;
  className?: string;
}) {
  const spec = crestSpec(seed, String(number));
  const shield = "M1 1 L17 1 L17 9.5 Q17 14 9 17 Q1 14 1 9.5 Z";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      role="img"
      aria-label={`Club crest, number ${number}`}
      className={className}
      shapeRendering="crispEdges"
    >
      <defs>
        <clipPath id={`crest-${fnv1a(`${seed}::${number}`)}`}>
          <path d={shield} />
        </clipPath>
      </defs>
      <path d={shield} fill={spec.field} />
      <g clipPath={`url(#crest-${fnv1a(`${seed}::${number}`)})`}>
        {spec.cells.map((c, i) => (
          <rect
            key={i}
            x={c.x * 2}
            y={c.y * 2}
            width={2}
            height={2}
            fill={c.color}
            opacity={0.9}
          />
        ))}
      </g>
      <path
        d={shield}
        fill="none"
        stroke={spec.border}
        strokeWidth="0.8"
        shapeRendering="auto"
      />
    </svg>
  );
}
