// Playability rules, enforced server-side (not just in the UI).
//
// Entering the pitch is allowed ONLY on:
//   a) a genuinely live fixture in live mode (the enter route confirms
//      the fold-derived phase is live and pre-regulation-whistle), and
//   b) one of the three bundled REPLAY fixtures, the judges' demo path.
//
// Everything else is watch-or-read only. Replay mode is a demo affordance
// that only makes sense for the fixtures we ship data for, so any other
// fixture id in replay mode is rejected outright.

export const BUNDLED_REPLAY_IDS: ReadonlySet<number> = new Set([
  18202701, // Argentina v Egypt
  18202783, // Switzerland v Colombia
  18209181, // France v Morocco
]);

export function isBundledReplay(fixtureId: number): boolean {
  return BUNDLED_REPLAY_IDS.has(fixtureId);
}

// Live window heuristic, matching the schedule's: a fixture is LIVE from
// kickoff to roughly full time plus 30 minutes. Used for a cheap
// time-based entry gate so we never fold a days-old finished fixture's
// whole live log just to reject it.
export const LIVE_WINDOW_MS = 150 * 60_000;

export type TimePhase = "upcoming" | "live" | "finished";
export function timePhase(startTime: number, now: number): TimePhase {
  if (now < startTime) return "upcoming";
  if (now < startTime + LIVE_WINDOW_MS) return "live";
  return "finished";
}

// Broadcast-voice copy for the rejections.
export const IN_THE_BOOKS = "That one is in the books.";
export const NO_REPLAY = "No replay on file for that one.";
