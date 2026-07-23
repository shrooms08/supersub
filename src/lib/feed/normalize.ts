// The single normalization layer (binding architecture requirement 1).
//
// TxLINE serves the same logical payloads with inconsistent key casing:
// the historical endpoints and observed SSE streams use PascalCase
// ("FixtureId") while the OpenAPI schemas and some live paths declare
// camelCase ("fixtureId"). Every accessor here tolerates both, so the rest
// of the app is immune to which spelling a given endpoint picked.
//
// This module also encodes the single most dangerous quirk of the feed
// (spike finding, risk 2): inside Score and Stats maps, an ABSENT KEY MEANS
// ZERO, not "unchanged". Normalized TeamCounters are therefore zero-filled
// at the moment a participant's Score entry is present, and omitted
// entirely when it is not, so downstream folds can tell "zero" apart from
// "no information".
//
// No component, hook, source, or route handler may touch raw feed shapes.
// They import MatchEvent / OddsUpdate / Fixture from ./types and call the
// normalize* functions below.

import type {
  Fixture,
  MatchEvent,
  OddsUpdate,
  TeamCounters,
} from "./types";

type Raw = Record<string, unknown>;

// Read a field by its PascalCase name, falling back to camelCase.
function k<T = unknown>(obj: unknown, pascal: string): T | undefined {
  if (obj === null || typeof obj !== "object") return undefined;
  const o = obj as Raw;
  if (pascal in o) return o[pascal] as T;
  const camel = pascal.charAt(0).toLowerCase() + pascal.slice(1);
  if (camel in o) return o[camel] as T;
  return undefined;
}

function num(obj: unknown, pascal: string): number | undefined {
  const v = k(obj, pascal);
  return typeof v === "number" ? v : undefined;
}

function bool(obj: unknown, pascal: string): boolean | undefined {
  const v = k(obj, pascal);
  return typeof v === "boolean" ? v : undefined;
}

function str(obj: unknown, pascal: string): string | undefined {
  const v = k(obj, pascal);
  return typeof v === "string" ? v : undefined;
}

// Zero-fill a raw per-period counter object ({Goals: 1} or {goals: 1}).
// Absent keys are real zeroes by feed contract.
function counters(raw: unknown): TeamCounters {
  return {
    goals: num(raw, "Goals") ?? 0,
    corners: num(raw, "Corners") ?? 0,
    yellowCards: num(raw, "YellowCards") ?? 0,
    redCards: num(raw, "RedCards") ?? 0,
  };
}

// A participant entry in the Score map is authoritative for that team's
// cumulative totals when present. Entry present but Total missing still
// means "all totals zero" per the absent-key-means-zero contract.
function scoreEntry(scoreMap: unknown, participant: 1 | 2): TeamCounters | undefined {
  const entry = k(scoreMap, `Participant${participant}`);
  if (entry === undefined || entry === null) return undefined;
  return counters(k(entry, "Total") ?? {});
}

export function normalizeMatchEvent(raw: unknown): MatchEvent | null {
  const fixtureId = num(raw, "FixtureId");
  const seq = num(raw, "Seq");
  const action = str(raw, "Action");
  const ts = num(raw, "Ts");
  if (fixtureId === undefined || seq === undefined || action === undefined || ts === undefined) {
    return null;
  }

  const rawClock = k(raw, "Clock");
  const clock =
    rawClock !== undefined && rawClock !== null
      ? {
          running: bool(rawClock, "Running") ?? false,
          seconds: num(rawClock, "Seconds") ?? 0,
        }
      : undefined;

  const rawScore = k(raw, "Score");
  const p1 = scoreEntry(rawScore, 1);
  const p2 = scoreEntry(rawScore, 2);
  const score = p1 !== undefined || p2 !== undefined ? { p1, p2 } : undefined;

  // Penalty shootout tally. The feed keeps shootout goals in a separate
  // PE period map, deliberately excluded from Total (regulation and ET
  // never mix with shootout kicks). Present on either participant means
  // a shootout is in progress or done; absent goals inside a present PE
  // map are zero by the same contract as every other counter.
  // k()'s camel fallback for "PE" would be "pE", so try "pe" explicitly.
  const peEntry = (part: unknown) => k(part, "PE") ?? k(part, "Pe");
  const pe1 = peEntry(k(rawScore, "Participant1"));
  const pe2 = peEntry(k(rawScore, "Participant2"));
  const shootoutScore =
    (pe1 !== undefined && pe1 !== null) || (pe2 !== undefined && pe2 !== null)
      ? { p1: num(pe1 ?? {}, "Goals") ?? 0, p2: num(pe2 ?? {}, "Goals") ?? 0 }
      : undefined;

  // Data subfields the app reads, lifted with casing tolerance. The raw
  // blob is not forwarded.
  const rawData = k(raw, "Data");
  let data: Record<string, unknown> | undefined;
  if (rawData !== null && typeof rawData === "object") {
    data = {};
    const minutes = num(rawData, "Minutes");
    const outcome = str(rawData, "Outcome");
    const goalType = str(rawData, "GoalType");
    const varType = str(rawData, "Type");
    const dataStatusId = num(rawData, "StatusId");
    if (minutes !== undefined) data.minutes = minutes;
    if (outcome !== undefined) data.outcome = outcome;
    if (goalType !== undefined) data.goalType = goalType;
    if (varType !== undefined) data.type = varType;
    if (dataStatusId !== undefined) data.statusId = dataStatusId;
    if (Object.keys(data).length === 0) data = undefined;
  }

  return {
    fixtureId,
    seq,
    id: num(raw, "Id") ?? seq,
    ts,
    action,
    statusId: num(raw, "StatusId"),
    confirmed: bool(raw, "Confirmed"),
    participant: num(raw, "Participant"),
    clock,
    score,
    shootoutScore,
    data,
    startTime: num(raw, "StartTime"),
  };
}

export function normalizeOddsUpdate(raw: unknown): OddsUpdate | null {
  const fixtureId = num(raw, "FixtureId");
  const ts = num(raw, "Ts");
  const superOddsType = str(raw, "SuperOddsType");
  if (fixtureId === undefined || ts === undefined || superOddsType === undefined) {
    return null;
  }
  const marketPeriod = k<string | null>(raw, "MarketPeriod");
  return {
    fixtureId,
    ts,
    messageId: str(raw, "MessageId"),
    superOddsType,
    marketPeriod: typeof marketPeriod === "string" ? marketPeriod : null,
    inRunning: bool(raw, "InRunning") ?? false,
    priceNames: (k<string[]>(raw, "PriceNames") ?? []).slice(),
    prices: (k<number[]>(raw, "Prices") ?? []).slice(),
    pct: (k<string[]>(raw, "Pct") ?? []).slice(),
  };
}

export function normalizeFixture(raw: unknown): Fixture | null {
  const fixtureId = num(raw, "FixtureId");
  const startTime = num(raw, "StartTime");
  const participant1 = str(raw, "Participant1");
  const participant2 = str(raw, "Participant2");
  if (
    fixtureId === undefined ||
    startTime === undefined ||
    participant1 === undefined ||
    participant2 === undefined
  ) {
    return null;
  }
  return {
    fixtureId,
    startTime,
    competition: str(raw, "Competition") ?? "",
    competitionId: num(raw, "CompetitionId"),
    participant1,
    participant2,
    participant1Id: num(raw, "Participant1Id"),
    participant2Id: num(raw, "Participant2Id"),
    participant1IsHome: bool(raw, "Participant1IsHome") ?? true,
  };
}

export function is1x2FullTime(o: OddsUpdate): boolean {
  return o.superOddsType === "1X2_PARTICIPANT_RESULT" && o.marketPeriod === null;
}

// Parse a body that may be a JSON array (per the OpenAPI spec) or SSE-framed
// "data: {...}" lines (observed reality on /scores/historical). Returns raw
// objects; callers pass them through normalizeMatchEvent/normalizeOddsUpdate.
export function parseArrayOrSseFraming(rawText: string): unknown[] {
  const trimmed = rawText.trim();
  if (trimmed === "") return [];
  if (trimmed.startsWith("[")) return JSON.parse(trimmed) as unknown[];
  const out: unknown[] = [];
  for (const line of trimmed.split("\n")) {
    const l = line.trim();
    if (l.startsWith("data:")) {
      try {
        out.push(JSON.parse(l.slice(5).trim()));
      } catch {
        // skip malformed lines rather than aborting the whole backfill
      }
    }
  }
  return out;
}
