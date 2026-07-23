// Team display helpers, server-safe (no "use client" boundary) so both
// server components (the bracket) and client components (the scoreboard,
// the match report) can share them.

// Broadcast-style three-letter code from a team name, e.g. "SWI" for
// Switzerland. Falls back to "---" when a name has no letters.
export function teamCode(name: string): string {
  return name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "---";
}
