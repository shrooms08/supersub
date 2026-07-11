// Signing Day HTTP smoke (design phase 2), against a running server:
//
//   node scripts/smoke-signing.mjs [baseUrl]
//
// 1. First-run signal: no cookie, GET /api/player answers player: null.
// 2. The write rejects out-of-contract surnames with 400 (1 char, 13
//    chars, digits, inner space, leading hyphen).
// 3. A conforming double-barrelled surname signs at 201, normalized to
//    uppercase, and the cookie comes back signed.
// 4. A second signing on the same cookie answers 409.
// 5. Renaming answers 403 (identity is permanent).
// 6. Legacy players signed under the old rule still function: a row with
//    a spaced, mixed-case name is written directly (as legacy data would
//    be), its cookie is minted with the same HMAC the server uses, and
//    GET /api/career serves it.

import * as fs from "node:fs";
import * as path from "node:path";
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const BASE = process.argv[2] ?? "http://localhost:3000";
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const log = (m) => console.log(`[smoke6] ${m}`);
let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`[smoke6] ${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
};

async function post(body, cookie) {
  const res = await fetch(`${BASE}/api/player`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json(), setCookie: res.headers.get("set-cookie") };
}

// 1. First-run signal
const fresh = await fetch(`${BASE}/api/player`);
const freshBody = await fresh.json();
check("first run: GET /api/player has player null", freshBody.player === null);

// 2. Validation bounds at the write
for (const [label, name] of [
  ["1 char", "A"],
  ["13 chars", "ABCDEFGHIJKLM"],
  ["digits", "SMOKE1"],
  ["inner space", "DE JONG"],
  ["leading hyphen", "-ABEL"],
]) {
  const r = await post({ name, position: "ST", shirtNumber: 7 });
  check(`write rejects ${label} with 400`, r.status === 400, `got ${r.status}`);
}

// 3. Conforming signing
const suffix = String(Date.now()).slice(-4).replace(/\d/g, (d) => "ABCDEFGHIJ"[Number(d)]);
const signed = await post({ name: `smoke-${suffix.toLowerCase()}`, position: "CB", shirtNumber: 4 });
check("conforming surname signs with 201", signed.status === 201, `got ${signed.status}`);
check(
  "surname stored uppercase",
  signed.body.player?.name === `SMOKE-${suffix}`,
  signed.body.player?.name
);
const cookie = signed.setCookie?.split(";")[0] ?? "";
check("identity cookie set", cookie.startsWith("supersub_pid="));

// 4. One player per shirt
const dup = await post({ name: "SOMEONE", position: "ST", shirtNumber: 9 }, cookie);
check("second signing answers 409", dup.status === 409, `got ${dup.status}`);

// 5. Immutability
const patch = await fetch(`${BASE}/api/player`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json", Cookie: cookie },
  body: JSON.stringify({ name: "SNEAKY" }),
});
check("rename answers 403", patch.status === 403, `got ${patch.status}`);

// 6. Legacy row still functions (option A: no migration, old rows keep working)
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const legacyName = `Smoke Legacy ${String(Date.now()).slice(-4)}`; // old rule: spaces, mixed case; "Smoke " prefix keeps it purgeable
const { data: legacy, error } = await sb
  .from("players")
  .insert({ name: legacyName, position: "AM", shirt_number: 88 })
  .select()
  .single();
if (error) {
  check("legacy row inserted", false, error.message);
} else {
  const secret = process.env.SUPERSUB_SESSION_SECRET ?? "supersub-dev-secret-change-me";
  const sig = createHmac("sha256", secret).update(legacy.id).digest("base64url");
  const legacyCookie = `supersub_pid=${legacy.id}.${sig}`;
  const career = await fetch(`${BASE}/api/career`, { headers: { Cookie: legacyCookie } });
  const careerBody = await career.json();
  check(
    "legacy player (old-rule name) still serves a career",
    career.status === 200 && careerBody.player?.name === legacyName,
    `HTTP ${career.status}, name ${careerBody.player?.name}`
  );
  await sb.from("players").delete().eq("id", legacy.id);
}

// Clean up the signed test player.
if (signed.body.player?.id) {
  await sb.from("players").delete().eq("id", signed.body.player.id);
}

console.log(
  failures === 0 ? "[smoke6] ALL SIGNING CHECKS PASSED" : `[smoke6] ${failures} CHECKS FAILED`
);
process.exit(failures === 0 ? 0 : 1);
