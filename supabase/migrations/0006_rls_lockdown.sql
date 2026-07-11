-- SECURITY: remove all destructive capability from the anon role.
--
-- The audit that prompted this (see SMOKE8.md) found the exposure was
-- wider than migration 0005. Three permissive shapes shipped over
-- earlier phases, all granted to the public role (which anon and
-- authenticated inherit), all with USING (true):
--   players        FOR ALL   (Phase 2)  -> anon could delete/update any player
--   player_badges  FOR ALL   (Phase 2)  -> anon could delete/update any badge
--   entries        FOR DELETE (0005)    -> anon could delete any entry
-- So a holder of the public anon key could wipe or rewrite the whole
-- instance. (The anon key is a publishable key by category and must be
-- treated as public even though this app only uses it server-side.)
--
-- This migration replaces every permissive policy with the minimal set
-- the product actually performs, verified against the route handlers:
--   players        SELECT, INSERT           (create + read; PATCH is 403,
--                                            nothing updates or deletes)
--   entries        SELECT, INSERT, UPDATE   (enter, read, resolve fills
--                                            columns; nothing deletes)
--   player_badges  SELECT, INSERT, UPDATE   (award via upsert, read;
--                                            nothing deletes)
-- No DELETE for anon on any table. Deletion is now an admin-only
-- operation performed with the service-role key, which bypasses RLS and
-- needs no policy (see scripts/purge-test-players.mjs).
--
-- Per-caller ("own rows only") scoping is intentionally NOT attempted
-- here: identity is a signed cookie validated in the route handler, so
-- Postgres has no auth.uid() to scope on. The route handler remains the
-- authorization boundary, unchanged; this migration removes the
-- destructive blast radius, which is the security fix. Tighten to true
-- per-user RLS when real auth arrives. Idempotent: drop-if-exists then
-- create.

-- players ------------------------------------------------------------
drop policy if exists "players anon all" on public.players;
drop policy if exists "players anon select" on public.players;
drop policy if exists "players anon insert" on public.players;

create policy "players anon select" on public.players
  for select to anon, authenticated using (true);
create policy "players anon insert" on public.players
  for insert to anon, authenticated with check (true);

-- entries ------------------------------------------------------------
drop policy if exists "entries anon all" on public.entries;
drop policy if exists "entries anon select" on public.entries;
drop policy if exists "entries anon insert" on public.entries;
drop policy if exists "entries anon update" on public.entries;
drop policy if exists "entries anon delete" on public.entries;

create policy "entries anon select" on public.entries
  for select to anon, authenticated using (true);
create policy "entries anon insert" on public.entries
  for insert to anon, authenticated with check (true);
create policy "entries anon update" on public.entries
  for update to anon, authenticated using (true) with check (true);

-- player_badges ------------------------------------------------------
drop policy if exists "player_badges anon all" on public.player_badges;
drop policy if exists "player_badges anon select" on public.player_badges;
drop policy if exists "player_badges anon insert" on public.player_badges;
drop policy if exists "player_badges anon update" on public.player_badges;

create policy "player_badges anon select" on public.player_badges
  for select to anon, authenticated using (true);
create policy "player_badges anon insert" on public.player_badges
  for insert to anon, authenticated with check (true);
create policy "player_badges anon update" on public.player_badges
  for update to anon, authenticated using (true) with check (true);
