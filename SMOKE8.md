# SMOKE8: RLS security lockdown (blocks the promote)

Captured 2026-07-11. Trigger: migration 0005 added a permissive delete
policy on `entries` to make the anon-key purge work. The audit below
confirms 0005 opened anon deletes on `entries`, and found the exposure
was in fact wider: `players` and `player_badges` had allowed anon
deletes and cross-player writes since Phase 2.

## 1. Exactly what 0005 permitted

`supabase/migrations/0005_entries_delete_policy.sql`:

```sql
create policy "entries anon delete" on public.entries for delete using (true);
```

At capture time `pg_policies` reported it applied to `roles = {public}`
with `qual = true`. The `public` role is inherited by `anon` (and
`authenticated`), and the anon key is a publishable key by category
(public even though this app only uses it server-side). So yes: any
client holding the public anon key could delete any row in `entries`.

## 2. Full audit before the fix

`select tablename, policyname, cmd, roles, qual, with_check from
pg_policies where schemaname='public'` returned six permissive
policies, every one `roles={public}` with `USING/​WITH CHECK = true`:

| table | policy | cmd | effect for anon |
|---|---|---|---|
| entries | entries anon delete | DELETE | delete ANY entry (from 0005) |
| entries | entries anon insert | INSERT | insert (product needs this) |
| entries | entries anon select | SELECT | read (product needs this) |
| entries | entries anon update | UPDATE | update ANY entry |
| player_badges | player_badges anon all | ALL | insert/select/**update/delete** ANY badge |
| players | players anon all | ALL | insert/select/**update/delete** ANY player |

The two `FOR ALL` policies (shipped Phase 2) are the important finding:
they already let an anon-key holder delete every player and badge and
rewrite any player (e.g. rename another user), independent of 0005.
Dropping only the entries-delete policy would have left players and
badges wide open.

## 3. The fix

`supabase/migrations/0006_rls_lockdown.sql` (applied to production)
replaces all six with the minimal set the route handlers actually use,
verified by enumerating every `.from(...)` call in `src`:

```
players        SELECT, INSERT           (create + read; PATCH is 403)
entries        SELECT, INSERT, UPDATE   (enter, read, resolve)
player_badges  SELECT, INSERT, UPDATE   (award via upsert, read)
```

No anon DELETE on any table; no `FOR ALL`; scoped to `anon,
authenticated` explicitly. `pg_policies` after the migration:

```
entries        INSERT  {anon,authenticated}
entries        SELECT  {anon,authenticated}
entries        UPDATE  {anon,authenticated}
player_badges  INSERT  {anon,authenticated}
player_badges  SELECT  {anon,authenticated}
player_badges  UPDATE  {anon,authenticated}
players        INSERT  {anon,authenticated}
players        SELECT  {anon,authenticated}
```

Deletion is now admin-only, performed with the service-role key, which
bypasses RLS and needs no policy. `scripts/lib/admin-client.mjs` builds
that client from `SUPABASE_SERVICE_ROLE_KEY` and refuses to run without
it (so an anon-key delete can never silently no-op again, which is what
0005 was papering over). `purge-test-players`, `reset-demo`, and
`smoke-signing` now use it. The key is documented in `.env.example` as
scripts-only: never used by the app, never `NEXT_PUBLIC_`, never in the
app's Vercel env, `.env.local` is gitignored.

Per-caller ("own rows only") scoping is deliberately not attempted:
identity is a signed cookie validated in the route handler, so Postgres
has no `auth.uid()` to scope on. The route handler stays the
authorization boundary; this migration removes the destructive blast
radius. True per-user RLS is a real-auth follow-up.

## 4. Verification on production (supersub-tau, project huzrtjdt...)

### Anon deletes denied

Direct REST calls with the public anon key. PostgREST returns 200/204
for a delete that RLS makes match zero rows, so the proof is the empty
result body plus unchanged row counts, not the status code:

```
# broad anon delete of every entry, return=representation
$ curl -X DELETE ".../rest/v1/entries?id=not.is.null" -H "apikey: <ANON>" ...
  response body: []                # zero rows deleted
  entries before: 3   entries after: 3   # nothing removed

# targeted: insert a throwaway player as anon (INSERT still works), then
# anon-delete that exact id
  created player 5be237c1-...            (anon insert works: app needs it)
  rows anon deleted: []                  <- empty = RLS denied
  player still present: [{"name":"SMOKE-RLSTEST"}]

# players and player_badges broad anon deletes: same, rows untouched
```

### The privileged path deletes what anon cannot

The same throwaway row, deleted through an RLS-bypassing privileged
role (admin SQL, equivalent to the service_role the purge script uses):

```sql
delete from public.players where id = '5be237c1-...' returning id, name;
-- [{"id":"5be237c1-...","name":"SMOKE-RLSTEST"}]   deleted
```

The service-role secret is not retrievable in this environment (no MCP
tool exposes it, correctly), so the service_role path was verified via
the equivalent admin SQL role; the operator supplies
`SUPABASE_SERVICE_ROLE_KEY` to run the script itself. The script guard
was exercised: with no service key set, `purge-test-players --execute`
throws immediately ("SUPABASE_SERVICE_ROLE_KEY is not set...") and
deletes nothing, rather than silently no-opping.

### The app still works (anon insert/select/update intact)

`node scripts/smoke-career.mjs` end to end after the lockdown:

```
[smoke2] player created: SMOKE-BGIDG #14 (ST)          (anon INSERT players)
[smoke2] resolved: final 0-2, window -10, points 0, new badges [first_whistle]
[smoke2] resolved: final 0-0, window 40, points 291.5   (anon UPDATE entries, upsert badges)
[smoke2] career after match two: apps 2, impact 145.75, form [DL]  (anon SELECT)
[smoke2] ALL PHASE 2 SMOKE CHECKS PASSED
```

That single run exercises anon INSERT (player, two entries), UPDATE
(resolve fills entry columns, badge upsert), and SELECT (career), so
the product's whole anon footprint is confirmed working under the
tightened policies. The SMOKE- player was removed afterward; the
production table is back to exactly `minos` (rank 1), legendary
unchanged.

## Files

- `supabase/migrations/0006_rls_lockdown.sql` (applied)
- `scripts/lib/admin-client.mjs` (new)
- `scripts/purge-test-players.mjs`, `scripts/reset-demo.mjs`,
  `scripts/smoke-signing.mjs` (service-role key)
- `.env.example` (SUPABASE_SERVICE_ROLE_KEY documented, scripts-only)

Note: migration 0005's file stays in the repo as history (migrations
are append-only); 0006 supersedes its policy. Fold 16/16, badges 30/30,
signing 35/35 unchanged (no app logic touched).
