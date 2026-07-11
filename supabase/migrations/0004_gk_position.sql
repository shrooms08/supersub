-- GK becomes the twelfth stored position, its own display group.
-- Constraint edit only, same shape as 0003: no columns, tables, or data
-- change, and every existing row already satisfies the new list.
-- Idempotent: drop-if-exists then recreate.

alter table public.players
  drop constraint if exists players_position_check;

alter table public.players
  add constraint players_position_check
  check (position in ('GK', 'ST', 'LW', 'RW', 'AM', 'LM', 'CM', 'RM', 'DM', 'LB', 'CB', 'RB'));
