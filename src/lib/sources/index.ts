// Mode resolution: SUPERSUB_MODE env var sets the default, a ?mode= query
// param overrides per request. The same build serves both; there are no
// code changes between replay and live.

import { clampSpeed, createReplaySource, resetReplaySession } from "./replay";
import { createLiveSource } from "./live";
import type { MatchSource, Mode } from "./types";

export function resolveMode(param?: string | null): Mode {
  const raw = param ?? process.env.SUPERSUB_MODE ?? "replay";
  return raw === "live" ? "live" : "replay";
}

export function getSource(opts: { mode?: string | null; speed?: string | null } = {}): MatchSource {
  const mode = resolveMode(opts.mode);
  if (mode === "live") return createLiveSource();
  const speed = opts.speed !== undefined && opts.speed !== null ? clampSpeed(Number(opts.speed)) : undefined;
  return createReplaySource({ speed });
}

export { resetReplaySession };
export type { MatchSource, Mode };
