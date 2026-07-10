// The legend layer: a short narrative match report generated at resolution
// and stored once on the entry, never regenerated.
//
// Generation is claude-sonnet-4-6 through the official SDK, fed ONLY
// structured facts from the resolved entry. If the key is missing, the
// call fails, or the output is unusable, a deterministic template report
// built from the same facts is stored instead (report_source records
// which path ran).

import Anthropic from "@anthropic-ai/sdk";
import { tierForMultiplier } from "@/lib/config/scoring";
import { fmtMultiplier } from "@/lib/format";
import type { EntryRow } from "@/lib/entry";

export interface WindowEventFact {
  minute: number | null;
  // What happened, from the player's perspective.
  kind: "goal_for" | "goal_conceded" | "goal_overturned";
}

export interface ReportFacts {
  playerName: string;
  shirtNumber: number;
  position: string;
  teamName: string;
  opponentName: string;
  entryMinute: number;
  winProbAtEntryPct: number;
  multiplier: number;
  multiplierTier: string;
  scoreAtEntry: string;
  finalScore: string;
  windowEvents: WindowEventFact[];
  cleanSheetInWindow: boolean;
  windowPoints: number;
  finalPoints: number;
}

export function buildReportFacts(
  entry: EntryRow,
  player: { name: string; shirt_number: number; position: string }
): ReportFacts {
  const windowEvents: WindowEventFact[] = (entry.breakdown ?? [])
    .filter(
      (item) =>
        item.type === "goal_for" ||
        item.type === "goal_conceded" ||
        item.type === "goal_overturned"
    )
    .map((item) => ({ minute: item.minute, kind: item.type as WindowEventFact["kind"] }));

  return {
    playerName: player.name,
    shirtNumber: player.shirt_number,
    position: player.position,
    teamName: entry.team_name,
    opponentName: entry.opponent_name,
    entryMinute: entry.entry_minute,
    winProbAtEntryPct: Math.round(entry.win_prob_at_entry * 100),
    multiplier: entry.multiplier,
    multiplierTier: tierForMultiplier(entry.multiplier).name,
    scoreAtEntry: `${entry.score_team_at_entry}-${entry.score_opp_at_entry}`,
    finalScore: `${entry.final_score_team ?? 0}-${entry.final_score_opp ?? 0}`,
    windowEvents,
    cleanSheetInWindow: (entry.breakdown ?? []).some((i) => i.type === "clean_sheet"),
    windowPoints: entry.window_points ?? 0,
    finalPoints: entry.final_points ?? 0,
  };
}

const SYSTEM_PROMPT = `You are a football correspondent for a British broadsheet, filing a short dispatch about a fantasy substitute's shift in a real match. You will receive a JSON object of facts about one substitute appearance.

Write a match report of 60 to 90 words, in the third person, in the dry, literate voice of a British broadsheet. Refer to the player by their chosen name and shirt number (for example: Okafor, the number 14). Dry wit is allowed; melodrama is not.

Hard rules:
- Use ONLY the facts provided in the JSON. Never invent events, players, injuries, weather, crowds, or anything else that is not in the input. If the window was quiet, write about the quiet.
- The scores in the facts are from the player's side first (their team's goals, then the opponent's).
- Mention the multiplier tier name naturally (it is a fact in the input).
- Do not use em dashes or en dashes anywhere in the copy. Use commas, full stops, or semicolons instead.
- Output the report text only. No headline, no byline, no quotation marks around the whole piece.`;

function ordinal(n: number): string {
  const rem10 = n % 10;
  const rem100 = n % 100;
  if (rem10 === 1 && rem100 !== 11) return `${n}st`;
  if (rem10 === 2 && rem100 !== 12) return `${n}nd`;
  if (rem10 === 3 && rem100 !== 13) return `${n}rd`;
  return `${n}th`;
}

// Deterministic fallback: same facts, no model. Same voice, fewer flourishes.
export function templateReport(facts: ReportFacts): string {
  const lines: string[] = [];
  lines.push(
    `${facts.playerName}, the number ${facts.shirtNumber}, came on for ${facts.teamName} in the ${ordinal(facts.entryMinute)} minute at ${facts.scoreAtEntry}, the win priced at ${facts.winProbAtEntryPct} in 100; ${fmtMultiplier(facts.multiplier)} on the slip, ${facts.multiplierTier}.`
  );

  const goalsFor = facts.windowEvents.filter((e) => e.kind === "goal_for");
  const conceded = facts.windowEvents.filter((e) => e.kind === "goal_conceded");
  const overturned = facts.windowEvents.filter((e) => e.kind === "goal_overturned");

  if (goalsFor.length === 0 && conceded.length === 0 && overturned.length === 0) {
    lines.push(`What followed asked little of the substitute; no goals either way on the watch.`);
  } else {
    const bits: string[] = [];
    if (goalsFor.length > 0) {
      bits.push(
        `${facts.teamName} scored ${goalsFor.length === 1 ? "once" : `${goalsFor.length} times`} (${goalsFor.map((g) => `${g.minute ?? "?"}'`).join(", ")})`
      );
    }
    if (conceded.length > 0) {
      bits.push(
        `${facts.opponentName} struck ${conceded.length === 1 ? "once" : `${conceded.length} times`} (${conceded.map((g) => `${g.minute ?? "?"}'`).join(", ")})`
      );
    }
    if (overturned.length > 0) {
      bits.push(`VAR took one off the board`);
    }
    lines.push(`After that, ${bits.join(", and ")}.`);
  }

  if (facts.cleanSheetInWindow) {
    lines.push(`Nothing conceded on the shift.`);
  }

  lines.push(
    `It finished ${facts.finalScore}. The ledger reads ${facts.finalPoints} points, and the ledger does not do sentiment.`
  );

  return lines.join(" ");
}

function sanitize(text: string): string {
  // Belt and braces on the no-dashes rule, whatever the model does.
  return text.replace(/—|–/g, ",").replace(/\s+,/g, ",").trim();
}

export async function generateMatchReport(
  facts: ReportFacts
): Promise<{ report: string; source: "model" | "template" }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { report: templateReport(facts), source: "template" };
  }
  try {
    const client = new Anthropic({ timeout: 20_000, maxRetries: 1 });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(facts) }],
    });
    if (response.stop_reason === "refusal") {
      return { report: templateReport(facts), source: "template" };
    }
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join(" ");
    const report = sanitize(text);
    // A report that is implausibly short or empty is not worth storing.
    if (report.split(/\s+/).length < 25) {
      return { report: templateReport(facts), source: "template" };
    }
    return { report, source: "model" };
  } catch {
    return { report: templateReport(facts), source: "template" };
  }
}
