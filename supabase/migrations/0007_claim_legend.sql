-- Claim Your Legend: bind an authenticated Privy identity (and its
-- Solana wallet) to an anonymous cookie career. Additive and safe:
-- both columns are nullable, so every existing anonymous player keeps
-- working untouched, and anonymous play never requires any of this.
--
-- One account = one career, one wallet = one career: partial unique
-- indexes enforce uniqueness only over the bound (non-null) rows, so
-- the many unclaimed players (all NULL) never collide.

alter table public.players add column if not exists privy_user_id text;
alter table public.players add column if not exists wallet_address text;

create unique index if not exists players_privy_user_id_key
  on public.players (privy_user_id)
  where privy_user_id is not null;

create unique index if not exists players_wallet_address_key
  on public.players (wallet_address)
  where wallet_address is not null;

-- Claiming is done through this function, not a direct table UPDATE.
-- Migration 0006 deliberately left players with no anon UPDATE policy
-- (no cross-player writes, name immutable). Rather than reopen that,
-- the binding is exposed as one narrow SECURITY DEFINER operation:
--   - it only ever writes privy_user_id and wallet_address, never name
--     or anything else, so the immutability guarantee is intact;
--   - the `privy_user_id is null` guard makes claiming permanent: a
--     player that is already claimed matches zero rows and the function
--     returns NULL, which the endpoint turns into a 409;
--   - the partial unique indexes above make a second player claiming an
--     already-bound identity or wallet raise unique_violation, also a
--     409 at the endpoint.
-- It needs no service-role key in the app, and anon can do nothing with
-- it beyond this exact, safe binding.
create or replace function public.claim_player(
  p_player_id uuid,
  p_privy_user_id text,
  p_wallet_address text
)
returns public.players
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.players;
begin
  update public.players
    set privy_user_id = p_privy_user_id,
        wallet_address = p_wallet_address
    where id = p_player_id
      and privy_user_id is null
    returning * into result;
  return result;
end;
$$;

revoke all on function public.claim_player(uuid, text, text) from public;
grant execute on function public.claim_player(uuid, text, text) to anon, authenticated;
