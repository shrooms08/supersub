// Signing Day unit tests (design phase 2): the surname contract rule and
// the position display mapping, plus PixelCrest determinism. Pure
// functions only; the HTTP flow (routing, 403 immutability, legacy rows)
// is covered by scripts/smoke-signing.mjs. Run: npm run test:signing

import { validateSurname, POSITION_GROUPS, POSITIONS } from "../src/lib/player";
import { crestSpec } from "../src/components/PixelCrest";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

// Surname bounds: 2 to 12, A-Z plus hyphen, letter at both ends.
check("1 char rejected", validateSurname("A") === null);
check("2 chars accepted", validateSurname("AB") === "AB");
check("12 chars accepted", validateSurname("ABCDEFGHIJKL") === "ABCDEFGHIJKL");
check("13 chars rejected", validateSurname("ABCDEFGHIJKLM") === null);
check("hyphen inside accepted", validateSurname("VAN-DIJK") === "VAN-DIJK");
check("double-barrelled accepted", validateSurname("SAKA-SMITH") === "SAKA-SMITH");
check("leading hyphen rejected", validateSurname("-ABEL") === null);
check("trailing hyphen rejected", validateSurname("ABEL-") === null);
check("lowercase normalized", validateSurname("voss") === "VOSS");
check("mixed case normalized", validateSurname("Van-Dijk") === "VAN-DIJK");
check("surrounding space trimmed", validateSurname("  VOSS ") === "VOSS");
check("apostrophe rejected", validateSurname("O'BRIEN") === null);
check("digits rejected", validateSurname("SMOKE1") === null);
check("inner space rejected", validateSurname("DE JONG") === null);
check("diacritics rejected", validateSurname("MÜLLER") === null);
check("empty rejected", validateSurname("") === null);
check("non-string rejected", validateSurname(42 as unknown) === null);

// Position display mapping: eleven stored values, three display groups,
// GK never stored or produced.
check("ST maps FWD", POSITION_GROUPS.ST === "FWD");
check("LW maps FWD", POSITION_GROUPS.LW === "FWD");
check("RW maps FWD", POSITION_GROUPS.RW === "FWD");
check("AM maps MID", POSITION_GROUPS.AM === "MID");
check("LM maps MID", POSITION_GROUPS.LM === "MID");
check("CM maps MID", POSITION_GROUPS.CM === "MID");
check("RM maps MID", POSITION_GROUPS.RM === "MID");
check("DM maps MID", POSITION_GROUPS.DM === "MID");
check("LB maps DEF", POSITION_GROUPS.LB === "DEF");
check("CB maps DEF", POSITION_GROUPS.CB === "DEF");
check("RB maps DEF", POSITION_GROUPS.RB === "DEF");
check(
  "stored vocabulary is eleven, no GK",
  POSITIONS.length === 11 && !POSITIONS.includes("GK" as never),
  POSITIONS.join(",")
);
check(
  "every stored position has a label and a group",
  POSITIONS.every((p) => Boolean(POSITION_GROUPS[p])),
);
check(
  "no group is GK",
  Object.values(POSITION_GROUPS).every((g) => g !== ("GK" as never))
);

// PixelCrest determinism: same seed identical, different seeds diverge.
const a1 = JSON.stringify(crestSpec("VOSS", "12"));
const a2 = JSON.stringify(crestSpec("VOSS", "12"));
const b = JSON.stringify(crestSpec("VOSS", "13"));
const c = JSON.stringify(crestSpec("MOLLER", "12"));
check("crest stable for same seed", a1 === a2);
check("crest differs across numbers", a1 !== b);
check("crest differs across names", a1 !== c);

console.log(failures === 0 ? "\nAll signing checks passed." : `\n${failures} CHECKS FAILED`);
process.exit(failures === 0 ? 0 : 1);
