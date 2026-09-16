-- Ohrly MVP v0.1 — Accounts + CSV assisted setup
-- Account names, external IDs and imported attributes remain in localStorage.
-- Supabase stores only the pseudonymous account row and the episode -> account relation.

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_accounts_user_created
  on public.accounts(user_id, created_at desc);

alter table public.accounts enable row level security;

drop policy if exists "accounts_owner_select" on public.accounts;
drop policy if exists "accounts_owner_insert" on public.accounts;
drop policy if exists "accounts_owner_update" on public.accounts;
drop policy if exists "accounts_owner_delete" on public.accounts;

create policy "accounts_owner_select" on public.accounts for select using (auth.uid() = user_id);
create policy "accounts_owner_insert" on public.accounts for insert with check (auth.uid() = user_id);
create policy "accounts_owner_update" on public.accounts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "accounts_owner_delete" on public.accounts for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.accounts to authenticated;

alter table public.episodes
  add column if not exists account_id uuid null references public.accounts(id) on delete set null;

create index if not exists idx_episodes_account_created
  on public.episodes(account_id, created_at desc);

-- Tighten episode writes so a linked account must belong to the same user.
drop policy if exists "episodes_owner_insert" on public.episodes;
drop policy if exists "episodes_owner_update" on public.episodes;

create policy "episodes_owner_insert" on public.episodes for insert with check (
  auth.uid() = user_id
  and (
    account_id is null
    or exists(select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid())
  )
);

create policy "episodes_owner_update" on public.episodes for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id
  and (
    account_id is null
    or exists(select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid())
  )
);
