// Display formatting. Broadcast voice, tabular numbers, UTC kickoffs.

export function fmtPct(p: number): string {
  return `${Math.round(p * 100)}`;
}

export function fmtMultiplier(m: number): string {
  return `${m.toFixed(1)}x`;
}

export function fmtMinute(minute: number): string {
  return `${minute}'`;
}

export function fmtPoints(p: number): string {
  return Number.isInteger(p) ? String(p) : p.toFixed(1);
}

export function fmtKickoffUtc(ts: number): string {
  const d = new Date(ts);
  const date = d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
  return `${date}, ${time} UTC`;
}

export const ACTION_LABELS: Record<string, string> = {
  goal: "GOAL",
  yellow_card: "Yellow card",
  red_card: "Red card",
  corner: "Corner",
  penalty: "Penalty",
  penalty_outcome: "Penalty",
  var: "VAR check",
  var_end: "VAR",
  kickoff: "Kick off",
  halftime_finalised: "Half time",
  game_finalised: "Full time",
  additional_time: "Added time",
  substitution: "Substitution",
};
