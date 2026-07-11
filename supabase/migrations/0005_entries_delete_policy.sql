-- Hygiene support: entries had select/insert/update policies but no
-- delete policy, so the anon-key purge tooling silently deleted nothing
-- and then tripped the players FK. Same permissive hackathon posture as
-- the rest of the schema; tighten alongside the others when real auth
-- arrives. Policy change only; no tables, columns, or data touched.
-- (Numbered 0005: 0004 is reserved for the GK position widening.)

drop policy if exists "entries anon delete" on public.entries;
create policy "entries anon delete" on public.entries for delete using (true);
