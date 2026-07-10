// Deterministic avatar: a 5x5 mirrored pixel crest generated from a hash
// of name + shirt number. No external avatar services; the same player
// always renders the same crest, on the server or in the browser.

export interface AvatarSpec {
  // 5 rows x 5 cols of on/off pixels, already mirrored.
  grid: boolean[][];
  // Grayscale tones from the design system (volt stays reserved).
  foreground: string;
  background: string;
}

// FNV-1a, 32 bit. Stable across platforms.
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

const FOREGROUNDS = ["#f5f5f2", "#e8e8e4", "#b3b3ad", "#8b8b85"];
const BACKGROUNDS = ["#1b1b20", "#141418", "#26262c"];

export function avatarSpec(name: string, shirtNumber: number): AvatarSpec {
  const seedString = `${name.trim().toLowerCase()}#${shirtNumber}`;
  let state = fnv1a(seedString) || 1;
  const nextBit = () => {
    // xorshift32 over the fnv seed: cheap, deterministic, well mixed.
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return (state & 1) === 1;
  };

  const grid: boolean[][] = [];
  for (let row = 0; row < 5; row++) {
    const half = [nextBit(), nextBit(), nextBit()];
    grid.push([half[0], half[1], half[2], half[1], half[0]]);
  }
  // Guarantee a visible crest even for pathological seeds.
  if (!grid.some((row) => row.some(Boolean))) grid[2][2] = true;

  const h = fnv1a(`${seedString}:tone`);
  return {
    grid,
    foreground: FOREGROUNDS[h % FOREGROUNDS.length],
    background: BACKGROUNDS[(h >>> 8) % BACKGROUNDS.length],
  };
}
