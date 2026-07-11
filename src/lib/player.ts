// Player identity types and client-side API helpers. Shared by route
// handlers and components; no server-only imports.

export const POSITIONS = ["ST", "LW", "RW", "AM", "LM", "CM", "RM", "DM", "LB", "CB", "RB"] as const;
export type Position = (typeof POSITIONS)[number];

export const POSITION_LABELS: Record<Position, string> = {
  ST: "Striker",
  LW: "Left winger",
  RW: "Right winger",
  AM: "Attacking mid",
  LM: "Left mid",
  CM: "Central mid",
  RM: "Right mid",
  DM: "Holding mid",
  LB: "Left back",
  CB: "Centre back",
  RB: "Right back",
};

// Display grouping per the canonical design (DEF / MID / FWD). The five
// stored positions are unchanged; GK is not a stored value, and position
// feeds nothing in scoring (verified: cosmetic only).
export type PositionGroup = "DEF" | "MID" | "FWD";
export const POSITION_GROUPS: Record<Position, PositionGroup> = {
  ST: "FWD",
  LW: "FWD",
  RW: "FWD",
  AM: "MID",
  LM: "MID",
  CM: "MID",
  RM: "MID",
  DM: "MID",
  LB: "DEF",
  CB: "DEF",
  RB: "DEF",
};

// Surname on the shirt: 2 to 12 characters, A-Z plus hyphen, starting and
// ending with a letter. Returns the normalized (uppercased) surname or
// null. Enforced on the client and at the write; existing rows signed
// under the old rule are untouched and keep working.
export function validateSurname(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().toUpperCase();
  if (!/^[A-Z][A-Z-]{0,10}[A-Z]$/.test(name)) return null;
  return name;
}

export interface PlayerRow {
  id: string;
  name: string;
  position: Position;
  shirt_number: number;
  created_at: string;
}

export interface PlayerSummary {
  player: PlayerRow | null;
  // Career at a glance for the bench chip.
  appearances: number;
  impactRating: number | null;
  // fixture_id -> final_points for "you played this" card states.
  played: Record<number, number>;
}

export async function fetchPlayerSummary(): Promise<PlayerSummary> {
  const res = await fetch("/api/player", { cache: "no-store" });
  if (!res.ok) return { player: null, appearances: 0, impactRating: null, played: {} };
  return (await res.json()) as PlayerSummary;
}

export async function createPlayer(params: {
  name: string;
  position: Position;
  shirtNumber: number;
}): Promise<{ player?: PlayerRow; error?: string; status: number }> {
  // Hardened end: a hung function, a network drop, or a bodyless 500 all
  // come back as a plain failure the ceremony can show and re-arm from.
  try {
    const res = await fetch("/api/player", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(10_000),
    });
    let body: { player?: PlayerRow; error?: string } = {};
    try {
      body = (await res.json()) as { player?: PlayerRow; error?: string };
    } catch {
      // empty or non-JSON body; fall through with the status alone
    }
    return { ...body, status: res.status };
  } catch {
    return { status: 0 };
  }
}
