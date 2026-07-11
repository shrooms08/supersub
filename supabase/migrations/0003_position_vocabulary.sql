-- Widen the position CHECK constraint from five values to eleven
-- (adds LW, RW, LM, RM, LB, RB; still no GK). Constraint edit only:
-- no columns, tables, or data change, and every existing row already
-- satisfies the new list. Idempotent: drop-if-exists then recreate.

alter table public.players
  drop constraint if exists players_position_check;

alter table public.players
  add constraint players_position_check
  check (position in ('ST', 'LW', 'RW', 'AM', 'LM', 'CM', 'RM', 'DM', 'LB', 'CB', 'RB'));
