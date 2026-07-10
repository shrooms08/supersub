-- Super Sub, Phase 2: the player becomes a person with a career.
--
-- Adds players (identity), attaches every entry to a player, adds the
-- stored match report to entries, and adds the badge cabinet. Identity is
-- a signed anonymous id in a cookie pointing at players.id; no accounts.
--
-- Idempotent: every statement is IF NOT EXISTS / conditional, and the
-- legacy-entry backfill only touches rows with player_id still null.

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 20),
  position text not null check (position in ('ST', 'AM', 'CM', 'DM', 'CB')),
  shirt_number smallint not null check (shirt_number between 1 and 99),
  created_at timestamptz not null default now()
);

alter table public.entries add column if not exists player_id uuid references public.players(id);
alter table public.entries add column if not exists report text;
alter table public.entries add column if not exists report_source text
  check (report_source in ('model', 'template'));

-- Phase 1 entries were keyed by an anonymous localStorage id in user_id.
-- Give each legacy id a player of its own so every entry belongs to a
-- player. Runs only for rows still lacking a player_id, so re-applying is
-- a no-op.
do $$
declare
  legacy record;
  new_player uuid;
begin
  for legacy in
    select distinct user_id from public.entries where player_id is null
  loop
    insert into public.players (name, position, shirt_number)
    values ('Trialist', 'CM', 99)
    returning id into new_player;
    update public.entries set player_id = new_player where user_id = legacy.user_id and player_id is null;
  end loop;
end $$;

alter table public.entries alter column player_id set not null;

-- One entry per player per fixture, enforced in the database. The Phase 1
-- constraint on (user_id, fixture_id) stays; user_id now mirrors the
-- player id as text for new rows.
create unique index if not exists one_entry_per_player_per_fixture
  on public.entries (player_id, fixture_id);

create table if not exists public.player_badges (
  player_id uuid not null references public.players(id),
  badge text not null,
  entry_id uuid references public.entries(id),
  earned_at timestamptz not null default now(),
  primary key (player_id, badge)
);

-- Same hackathon RLS posture as Phase 1: anonymous identities, server
-- talks to these tables with the anon key.
alter table public.players enable row level security;
alter table public.player_badges enable row level security;

drop policy if exists "players anon all" on public.players;
create policy "players anon all" on public.players
  for all using (true) with check (true);

drop policy if exists "player_badges anon all" on public.player_badges;
create policy "player_badges anon all" on public.player_badges
  for all using (true) with check (true);
