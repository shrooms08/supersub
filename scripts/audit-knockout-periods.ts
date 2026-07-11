// Knockout-period audit for a bundled log (SMOKE9 item 7a).
//   npx tsx scripts/audit-knockout-periods.ts <fixtureId>
// Shows every status/kickoff/period boundary, every action whose clock
// reads past 90:00, and every penalty/shootout-typed action.
import * as fs from "node:fs";
import * as path from "node:path";

const fixtureId = Number(process.argv[2] ?? 18202783);
const bundle = path.join(process.cwd(), "data", "replay", String(fixtureId), "scores.json");
type Raw = Record<string, any>;
const raw = (JSON.parse(fs.readFileSync(bundle, "utf8")) as Raw[]).sort(
  (a, b) => (a.Seq ?? 0) - (b.Seq ?? 0)
);

const clockStr = (e: Raw) =>
  e.Clock?.Seconds !== undefined
    ? `${String(Math.floor(e.Clock.Seconds / 60)).padStart(3)}:${String(e.Clock.Seconds % 60).padStart(2, "0")}${e.Clock.Running ? "R" : " "}`
    : "   --  ";

console.log(`fixture ${fixtureId}: ${raw.length} raw events`);

console.log("\n== period/status boundaries (status, kickoff, halftime_finalised, game_finalised) ==");
for (const e of raw) {
  const a = String(e.Action ?? "?");
  if (!["status", "kickoff", "halftime_finalised", "game_finalised"].includes(a)) continue;
  console.log(
    `Seq ${String(e.Seq).padStart(4)} | ${clockStr(e)} | ${a.padEnd(19)} | StatusId=${e.StatusId ?? "-"} | Data=${JSON.stringify(e.Data ?? null)}`
  );
}

console.log("\n== actions with clock > 90:00 ==");
const past90 = raw.filter((e) => (e.Clock?.Seconds ?? 0) > 90 * 60);
const counts = new Map<string, number>();
for (const e of past90) {
  const a = String(e.Action ?? "?");
  counts.set(a, (counts.get(a) ?? 0) + 1);
}
console.log(`${past90.length} events past 90:00. By action: ${[...counts.entries()].map(([a, n]) => `${a}(${n})`).join(" ")}`);
for (const e of past90) {
  const a = String(e.Action ?? "?");
  if (["goal", "penalty", "penalty_outcome", "var", "var_end", "action_discarded", "red_card"].includes(a)) {
    console.log(
      `Seq ${String(e.Seq).padStart(4)} | ${clockStr(e)} | ${a.padEnd(16)} | id=${e.Id} | team=${e.Participant ?? "-"} | conf=${e.Confirmed ?? "-"} | Data=${JSON.stringify(e.Data ?? null)}`
    );
  }
}

console.log("\n== penalty/shootout-typed actions (any clock) ==");
for (const e of raw) {
  const a = String(e.Action ?? "?");
  if (a.includes("penalty") || a.includes("shootout")) {
    console.log(
      `Seq ${String(e.Seq).padStart(4)} | ${clockStr(e)} | ${a.padEnd(16)} | id=${e.Id} | team=${e.Participant ?? "-"} | conf=${e.Confirmed ?? "-"} | Data=${JSON.stringify(e.Data ?? null)} | Score.PE=${JSON.stringify({ p1: e.Score?.Participant1?.PE, p2: e.Score?.Participant2?.PE })}`
    );
  }
}

console.log("\n== period keys present across all Score maps ==");
const periodKeys = new Set<string>();
for (const e of raw) {
  for (const part of ["Participant1", "Participant2"]) {
    const entry = e.Score?.[part];
    if (entry) for (const k of Object.keys(entry)) periodKeys.add(k);
  }
}
console.log([...periodKeys].join(" "));

console.log("\n== goal actions anywhere in the log ==");
const goals = raw.filter((e) => (e.Action ?? "") === "goal");
console.log(
  goals.length === 0
    ? "(none)"
    : goals.map((e) => `Seq ${e.Seq} id=${e.Id} team=${e.Participant} clock=${clockStr(e)} conf=${e.Confirmed}`).join("\n")
);
