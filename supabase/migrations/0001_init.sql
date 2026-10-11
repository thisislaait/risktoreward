-- FundedDesk: users' prop accounts, open positions, closed trades and an order audit log.
-- Every table is row-level secured: a signed-in user can only read and write their own rows.
-- Run once in the Supabase SQL editor (or `supabase db push`).

-- ── Prop accounts ─────────────────────────────────────────────
create table public.trading_accounts (
  id                   text primary key,
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label                text not null,
  firm_id              text not null,
  challenge_type       text not null,
  account_size         numeric(14, 2) not null,
  starting_balance     numeric(14, 2) not null,
  current_balance      numeric(14, 2) not null,
  high_water_mark      numeric(14, 2) not null,
  eod_high_water_mark  numeric(14, 2),
  daily_start_balance  numeric(14, 2) not null,
  daily_pnl            numeric(14, 2) not null default 0,
  trading_day          text,               -- local date of the last daily reset, e.g. 2026-10-11
  rules                jsonb not null,     -- the firm rule set the account was created with
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index trading_accounts_user_idx on public.trading_accounts (user_id);

-- ── Open positions ────────────────────────────────────────────
-- Simulated until a platform is connected; then a cache of the platform's own positions.
create table public.positions (
  ticket       text primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id   text not null references public.trading_accounts (id) on delete cascade,
  instrument   text not null,
  direction    text not null check (direction in ('BUY', 'SELL')),
  lot_size     numeric(12, 2) not null check (lot_size > 0),
  entry_price  numeric(18, 6) not null,
  stop_loss    numeric(18, 6) not null,
  take_profit  numeric(18, 6),
  opened_at    timestamptz not null
);
create index positions_user_idx on public.positions (user_id);

-- ── Closed trades ─────────────────────────────────────────────
create table public.trade_logs (
  id           text primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id   text not null references public.trading_accounts (id) on delete cascade,
  instrument   text not null,
  direction    text not null check (direction in ('BUY', 'SELL')),
  lot_size     numeric(12, 2) not null,
  entry_price  numeric(18, 6) not null,
  exit_price   numeric(18, 6) not null,
  pnl          numeric(14, 2) not null,
  opened_at    timestamptz not null,
  closed_at    timestamptz not null
);
create index trade_logs_user_closed_idx on public.trade_logs (user_id, closed_at desc);

-- ── Order audit log ───────────────────────────────────────────
-- One row per order attempt: what was asked, what the rule check said, what the platform did.
-- Insert-only for users: there is no update or delete policy, so history can't be rewritten.
create table public.order_audit (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id   text,
  created_at   timestamptz not null default now(),
  action       text not null check (action in ('place', 'close')),
  platform     text not null,
  instrument   text not null,
  direction    text not null check (direction in ('BUY', 'SELL')),
  lot_size     numeric(12, 2) not null,
  verdict      text check (verdict in ('go', 'review', 'stop')),
  checks       jsonb,
  result       text not null check (result in ('filled', 'rejected')),
  fill_price   numeric(18, 6),
  error        text
);
create index order_audit_user_idx on public.order_audit (user_id, created_at desc);

-- ── Row-level security ────────────────────────────────────────
alter table public.trading_accounts enable row level security;
alter table public.positions        enable row level security;
alter table public.trade_logs       enable row level security;
alter table public.order_audit      enable row level security;

create policy "own accounts: read"   on public.trading_accounts for select using (user_id = auth.uid());
create policy "own accounts: insert" on public.trading_accounts for insert with check (user_id = auth.uid());
create policy "own accounts: update" on public.trading_accounts for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own accounts: delete" on public.trading_accounts for delete using (user_id = auth.uid());

create policy "own positions: read"   on public.positions for select using (user_id = auth.uid());
create policy "own positions: insert" on public.positions for insert
  with check (user_id = auth.uid() and exists (select 1 from public.trading_accounts a where a.id = account_id and a.user_id = auth.uid()));
create policy "own positions: delete" on public.positions for delete using (user_id = auth.uid());

create policy "own trades: read"   on public.trade_logs for select using (user_id = auth.uid());
create policy "own trades: insert" on public.trade_logs for insert
  with check (user_id = auth.uid() and exists (select 1 from public.trading_accounts a where a.id = account_id and a.user_id = auth.uid()));

create policy "own audit: read"   on public.order_audit for select using (user_id = auth.uid());
create policy "own audit: insert" on public.order_audit for insert with check (user_id = auth.uid());

-- Keep updated_at current.
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
create trigger trading_accounts_touch before update on public.trading_accounts
  for each row execute function public.touch_updated_at();
