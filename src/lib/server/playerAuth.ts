// Signed anonymous identity. The cookie holds "<playerId>.<hmac>" where the
// hmac is HMAC-SHA256 over the player id with SUPERSUB_SESSION_SECRET, so a
// client cannot forge someone else's player id. No accounts, no passwords;
// the player row in Supabase is the identity.

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { supabase } from "./supabase";
import type { PlayerRow } from "@/lib/player";

export const PLAYER_COOKIE = "supersub_pid";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function secret(): string {
  // A missing secret falls back to a fixed dev value so `npm run dev` works
  // from a fresh clone; set SUPERSUB_SESSION_SECRET in any shared deploy.
  return process.env.SUPERSUB_SESSION_SECRET ?? "supersub-dev-secret-change-me";
}

function sign(playerId: string): string {
  return createHmac("sha256", secret()).update(playerId).digest("base64url");
}

export function cookieValueFor(playerId: string): string {
  return `${playerId}.${sign(playerId)}`;
}

export function verifyCookieValue(value: string | undefined): string | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const playerId = value.slice(0, dot);
  const mac = value.slice(dot + 1);
  const expected = sign(playerId);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return playerId;
}

// Player id from the request cookie, or null. Does not hit the database.
export function playerIdFromCookies(): string | null {
  return verifyCookieValue(cookies().get(PLAYER_COOKIE)?.value);
}

// Full player row for the current request, or null when there is no valid
// cookie or the row is gone.
export async function currentPlayer(): Promise<PlayerRow | null> {
  const id = playerIdFromCookies();
  if (!id) return null;
  const { data } = await supabase()
    .from("players")
    .select()
    .eq("id", id)
    .maybeSingle<PlayerRow>();
  return data ?? null;
}

export function setPlayerCookie(playerId: string): void {
  cookies().set(PLAYER_COOKIE, cookieValueFor(playerId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
}
