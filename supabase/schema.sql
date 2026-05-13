create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.years (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, year)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year integer not null,
  app_id text,
  source_id text,
  generated_by text default 'manual',
  manually_edited boolean not null default false,
  date date,
  month text not null,
  category text default '',
  concept text default '',
  status text default 'Pagado',
  amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.income (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year integer not null,
  app_id text,
  source_id text,
  generated_by text default 'manual',
  manually_edited boolean not null default false,
  date date,
  month text not null,
  source text default '',
  concept text default '',
  type text default 'Fijo',
  status text default 'Pagado',
  amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year integer not null,
  app_id text,
  loan text default '',
  description text default '',
  total numeric(12,2) not null default 0,
  monthly_payment numeric(12,2) not null default 0,
  total_installments integer not null default 0,
  current_installment integer not null default 0,
  interest text default 'Sin interes',
  month_value numeric(12,2),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.savings_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year integer not null,
  app_id text,
  name text not null,
  color text default 'purple',
  use_current_interest_efficiency boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.savings_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.savings_accounts(id) on delete cascade,
  year integer not null,
  app_id text,
  date date,
  description text default '',
  initial numeric(12,2) not null default 0,
  deposit numeric(12,2) not null default 0,
  withdrawal numeric(12,2) not null default 0,
  interest numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fixed_budget_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year integer not null,
  app_id text,
  description text default '',
  amount numeric(12,2) not null default 0,
  use_fixed_amount boolean not null default false,
  is_interest boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fixed_budget_income (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year integer not null,
  app_id text,
  description text default '',
  amount numeric(12,2) not null default 0,
  use_fixed_amount boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fixed_budget_distribution (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year integer not null,
  app_id text,
  description text default '',
  percent numeric(8,6) not null default 0,
  destination text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.journal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year integer not null,
  action text not null,
  detail text default '',
  created_at timestamptz not null default now()
);

alter table public.income add column if not exists status text default 'Pagado';
alter table public.savings_accounts add column if not exists color text default 'purple';
alter table public.savings_accounts add column if not exists use_current_interest_efficiency boolean not null default false;
alter table public.fixed_budget_expenses add column if not exists use_fixed_amount boolean not null default false;
alter table public.fixed_budget_income add column if not exists use_fixed_amount boolean not null default false;
alter table public.payments add column if not exists app_id text;
alter table public.payments add column if not exists source_id text;
alter table public.payments add column if not exists generated_by text default 'manual';
alter table public.payments add column if not exists manually_edited boolean not null default false;
alter table public.income add column if not exists app_id text;
alter table public.income add column if not exists source_id text;
alter table public.income add column if not exists generated_by text default 'manual';
alter table public.income add column if not exists manually_edited boolean not null default false;
alter table public.debts add column if not exists app_id text;
alter table public.savings_accounts add column if not exists app_id text;
alter table public.savings_entries add column if not exists app_id text;
alter table public.savings_entries add column if not exists withdrawal numeric(12,2) not null default 0;
alter table public.fixed_budget_expenses add column if not exists app_id text;
alter table public.fixed_budget_income add column if not exists app_id text;
alter table public.fixed_budget_income add column if not exists is_interest boolean not null default false;
alter table public.fixed_budget_distribution add column if not exists app_id text;

create index if not exists years_user_year_idx on public.years(user_id, year);
create index if not exists payments_user_year_idx on public.payments(user_id, year);
create index if not exists income_user_year_idx on public.income(user_id, year);
create index if not exists debts_user_year_idx on public.debts(user_id, year);
create index if not exists savings_accounts_user_year_idx on public.savings_accounts(user_id, year);
create index if not exists savings_entries_user_year_idx on public.savings_entries(user_id, year);
create index if not exists fixed_budget_expenses_user_year_idx on public.fixed_budget_expenses(user_id, year);
create index if not exists fixed_budget_income_user_year_idx on public.fixed_budget_income(user_id, year);
create index if not exists fixed_budget_distribution_user_year_idx on public.fixed_budget_distribution(user_id, year);
create index if not exists journal_user_year_idx on public.journal(user_id, year);

drop trigger if exists set_years_updated_at on public.years;
create trigger set_years_updated_at before update on public.years for each row execute function public.set_updated_at();

drop trigger if exists set_payments_updated_at on public.payments;
create trigger set_payments_updated_at before update on public.payments for each row execute function public.set_updated_at();

drop trigger if exists set_income_updated_at on public.income;
create trigger set_income_updated_at before update on public.income for each row execute function public.set_updated_at();

drop trigger if exists set_debts_updated_at on public.debts;
create trigger set_debts_updated_at before update on public.debts for each row execute function public.set_updated_at();

drop trigger if exists set_savings_accounts_updated_at on public.savings_accounts;
create trigger set_savings_accounts_updated_at before update on public.savings_accounts for each row execute function public.set_updated_at();

drop trigger if exists set_savings_entries_updated_at on public.savings_entries;
create trigger set_savings_entries_updated_at before update on public.savings_entries for each row execute function public.set_updated_at();

drop trigger if exists set_fixed_budget_expenses_updated_at on public.fixed_budget_expenses;
create trigger set_fixed_budget_expenses_updated_at before update on public.fixed_budget_expenses for each row execute function public.set_updated_at();

drop trigger if exists set_fixed_budget_income_updated_at on public.fixed_budget_income;
create trigger set_fixed_budget_income_updated_at before update on public.fixed_budget_income for each row execute function public.set_updated_at();

drop trigger if exists set_fixed_budget_distribution_updated_at on public.fixed_budget_distribution;
create trigger set_fixed_budget_distribution_updated_at before update on public.fixed_budget_distribution for each row execute function public.set_updated_at();

alter table public.years enable row level security;
alter table public.payments enable row level security;
alter table public.income enable row level security;
alter table public.debts enable row level security;
alter table public.savings_accounts enable row level security;
alter table public.savings_entries enable row level security;
alter table public.fixed_budget_expenses enable row level security;
alter table public.fixed_budget_income enable row level security;
alter table public.fixed_budget_distribution enable row level security;
alter table public.journal enable row level security;

drop policy if exists "Users can read own years" on public.years;
create policy "Users can read own years" on public.years for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own years" on public.years;
create policy "Users can insert own years" on public.years for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own years" on public.years;
create policy "Users can update own years" on public.years for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own years" on public.years;
create policy "Users can delete own years" on public.years for delete using (auth.uid() = user_id);

drop policy if exists "Users can manage own payments" on public.payments;
create policy "Users can manage own payments" on public.payments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own income" on public.income;
create policy "Users can manage own income" on public.income for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own debts" on public.debts;
create policy "Users can manage own debts" on public.debts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own savings accounts" on public.savings_accounts;
create policy "Users can manage own savings accounts" on public.savings_accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own savings entries" on public.savings_entries;
create policy "Users can manage own savings entries" on public.savings_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own fixed budget expenses" on public.fixed_budget_expenses;
create policy "Users can manage own fixed budget expenses" on public.fixed_budget_expenses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own fixed budget income" on public.fixed_budget_income;
create policy "Users can manage own fixed budget income" on public.fixed_budget_income for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own fixed budget distribution" on public.fixed_budget_distribution;
create policy "Users can manage own fixed budget distribution" on public.fixed_budget_distribution for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own journal" on public.journal;
create policy "Users can manage own journal" on public.journal for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
