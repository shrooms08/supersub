// Admin Supabase client for destructive maintenance tooling (purge,
// reset, test cleanup). Uses SUPABASE_SERVICE_ROLE_KEY, which bypasses
// RLS entirely and needs no policy. The anon key CANNOT delete anymore
// (migration 0006), so tooling that deletes MUST use this.
//
// The service-role key is a full-access secret: it is read from the
// environment (or .env.local) only, is NEVER referenced with a
// NEXT_PUBLIC_ prefix, is never sent to the browser, and must never be
// committed. The deployed app does not use it: the app only inserts,
// selects, and updates, which the anon key still permits.
//
// This helper refuses to fall back to the anon key. Before 0006, an
// anon-key delete silently deleted nothing (no delete policy) and then
// failed on the foreign key; the loud failure here prevents that class
// of silent no-op from ever recurring.

import * as fs from "node:fs";
import * as path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

export function adminClient() {
  loadEnvLocal();
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) {
    throw new Error("SUPABASE_URL is not set.");
  }
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Destructive tooling needs the " +
        "service-role key (Supabase dashboard > Settings > API). The anon key " +
        "cannot delete since migration 0006. Set it in .env.local (gitignored) " +
        "or inline for one run; never commit it, never use a NEXT_PUBLIC_ name."
    );
  }
  if (serviceKey === process.env.SUPABASE_ANON_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY equals the anon key; that key cannot delete. " +
        "Use the real service-role secret."
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
