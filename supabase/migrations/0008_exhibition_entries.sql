-- Exhibition entries (operator decision, post-freeze). Entries on the
-- three bundled replay fixtures are exhibitions: they keep the full loop
-- (enter, resolution, report, career history) but never touch a
-- competitive number (Impact Rating, career points, form, The Table,
-- Legendary Entries, or the appearance-gated badges). Live-fixture
-- entries are untouched.
--
-- One boolean, defaulting false, derived from the bundled-fixture id list
-- at resolution time. The retroactive backfill of existing rows is run
-- separately (dry run first); it is NOT in this migration so the tagging
-- delta can be reviewed before it lands.

alter table public.entries
  add column if not exists exhibition boolean not null default false;
