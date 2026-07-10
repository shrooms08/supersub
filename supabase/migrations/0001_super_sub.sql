-- Super Sub, Phase 1: entries and their resolved results.
--
-- One row per (user, fixture): the entry is written when the player steps
-- on the pitch, the resolution columns are filled at the final whistle.
-- Identity is an anonymous local id (uuid generated client side and kept
-- in localStorage); there is no auth in this phase.
--
-- "One entry per user per fixture" is enforced here, in the database,
-- by the unique constraint; the API surfaces the violation as 409.

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  fixture_id bigint not null,
  mode text not null default 'replay' check (mode in ('replay', 'live')),

  -- The pick, locked at entry.
  team smallint not null check (team in (1, 2)),
  team_name text not null,
  opponent_name text not null,

  -- The entry instant, on the feed timeline.
  entry_feed_ts bigint not null,
  entry_clock_seconds integer not null,
  entry_minute integer not null,
  score_team_at_entry smallint not null default 0,
  score_opp_at_entry smallint not null default 0,

  -- Locked at entry: win probability for the chosen team at that instant,
  -- and the multiplier it fixes.
  win_prob_at_entry double precision not null,
  multiplier double precision not null,

  created_at timestamptz not null default now(),

  -- Resolution, computed only from the final event-sourced state at the
  -- whistle. Null until resolved.
  resolved_at timestamptz,
  window_points integer,
  final_points double precision,
  final_score_team smallint,
  final_score_opp smallint,
  breakdown jsonb,

  constraint one_entry_per_user_per_fixture unique (user_id, fixture_id)
);

create index if not exists entries_fixture_idx on public.entries (fixture_id);

-- Hackathon security posture, on purpose: identities are anonymous local
-- ids and the app's route handlers talk to this table with the anon key,
-- so RLS is enabled with permissive policies. Tighten when real auth
-- arrives in a later phase.
alter table public.entries enable row level security;

drop policy if exists "entries anon select" on public.entries;
create policy "entries anon select" on public.entries for select using (true);

drop policy if exists "entries anon insert" on public.entries;
create policy "entries anon insert" on public.entries for insert with check (true);

drop policy if exists "entries anon update" on public.entries;
create policy "entries anon update" on public.entries for update using (true) with check (true);
