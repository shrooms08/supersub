// Player identity types and client-side API helpers. Shared by route
// handlers and components; no server-only imports.

export const POSITIONS = ["ST", "AM", "CM", "DM", "CB"] as const;
export type Position = (typeof POSITIONS)[number];

export const POSITION_LABELS: Record<Position, string> = {
  ST: "Striker",
  AM: "Attacking mid",
  CM: "Central mid",
  DM: "Holding mid",
  CB: "Centre back",
};

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
  const res = await fetch("/api/player", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const body = (await res.json()) as { player?: PlayerRow; error?: string };
  return { ...body, status: res.status };
}

export async function renamePlayer(name: string): Promise<{ player?: PlayerRow; error?: string; status: number }> {
  const res = await fetch("/api/player", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const body = (await res.json()) as { player?: PlayerRow; error?: string };
  return { ...body, status: res.status };
}
