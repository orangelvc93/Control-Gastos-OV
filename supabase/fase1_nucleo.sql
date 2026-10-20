-- Fase 1 · Núcleo contable: cuentas, categorías y movimientos (libro continuo).
-- Diseño: conocimiento/Esquema de datos (fase 1).md
-- Idempotente: se puede ejecutar varias veces. No modifica las tablas anteriores (payments, income, savings_*...).

-- Tipos -------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'account_type') then
    create type public.account_type as enum ('corriente', 'ahorro', 'efectivo', 'tarjeta_credito', 'inversion', 'poliza');
  end if;
  if not exists (select 1 from pg_type where typname = 'rate_type') then
    create type public.rate_type as enum ('nominal', 'efectiva');
  end if;
  if not exists (select 1 from pg_type where typname = 'category_kind') then
    create type public.category_kind as enum ('ingreso', 'gasto');
  end if;
  if not exists (select 1 from pg_type where typname = 'sri_category') then
    create type public.sri_category as enum ('vivienda', 'salud', 'educacion', 'alimentacion', 'vestimenta', 'turismo');
  end if;
  if not exists (select 1 from pg_type where typname = 'tax_income_type') then
    create type public.tax_income_type as enum ('relacion_dependencia', 'honorarios', 'rendimientos_financieros', 'otros');
  end if;
  if not exists (select 1 from pg_type where typname = 'tx_kind') then
    create type public.tx_kind as enum ('ingreso', 'gasto', 'transferencia', 'ajuste');
  end if;
  if not exists (select 1 from pg_type where typname = 'tx_status') then
    create type public.tx_status as enum ('confirmado', 'pendiente');
  end if;
end $$;

-- Cuentas -----------------------------------------------------------------

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  institution text not null default '',
  type public.account_type not null,
  currency text not null default 'USD' check (currency = 'USD'),
  opening_balance numeric(14,2) not null default 0,
  opening_date date not null default current_date,
  interest_rate numeric(8,4) check (interest_rate is null or interest_rate >= 0),
  rate_type public.rate_type,
  day_basis smallint check (day_basis is null or day_basis in (360, 365)),
  capitalizes boolean not null default true,
  interest_account_id uuid,
  credit_limit numeric(14,2) check (credit_limit is null or credit_limit >= 0),
  statement_day smallint check (statement_day is null or statement_day between 1 and 31),
  due_day smallint check (due_day is null or due_day between 1 and 31),
  color text not null default 'purple',
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (interest_account_id, user_id) references public.accounts(id, user_id)
);

-- Categorías --------------------------------------------------------------

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  kind public.category_kind not null,
  parent_id uuid,
  sri_category public.sri_category,
  tax_income_type public.tax_income_type,
  is_system boolean not null default false,
  color text not null default 'purple',
  icon text not null default '',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, kind, name),
  foreign key (parent_id, user_id) references public.categories(id, user_id)
);

-- Movimientos -------------------------------------------------------------

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid not null,
  date date not null,
  amount numeric(14,2) not null,
  kind public.tx_kind not null,
  category_id uuid,
  transfer_id uuid,
  status public.tx_status not null default 'confirmado',
  description text not null default '',
  note text not null default '',
  deductible boolean not null default false,
  legacy_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (account_id, user_id) references public.accounts(id, user_id),
  foreign key (category_id, user_id) references public.categories(id, user_id),
  -- Ingreso entra (+), gasto sale (−); transferencias y ajustes no llevan categoría.
  constraint transactions_kind_rules check (
    (kind = 'ingreso' and amount > 0 and category_id is not null and transfer_id is null)
    or (kind = 'gasto' and amount < 0 and category_id is not null and transfer_id is null)
    or (kind = 'transferencia' and amount <> 0 and category_id is null and transfer_id is not null)
    or (kind = 'ajuste' and amount <> 0 and category_id is null and transfer_id is null)
  )
);

create index if not exists accounts_user_idx on public.accounts(user_id);
create index if not exists categories_user_idx on public.categories(user_id);
create index if not exists transactions_user_date_idx on public.transactions(user_id, date desc);
create index if not exists transactions_account_idx on public.transactions(account_id, date);
create index if not exists transactions_transfer_idx on public.transactions(transfer_id) where transfer_id is not null;
create unique index if not exists transactions_legacy_ref_idx on public.transactions(user_id, legacy_ref) where legacy_ref is not null;

drop trigger if exists set_accounts_updated_at on public.accounts;
create trigger set_accounts_updated_at before update on public.accounts for each row execute function public.set_updated_at();
drop trigger if exists set_categories_updated_at on public.categories;
create trigger set_categories_updated_at before update on public.categories for each row execute function public.set_updated_at();
drop trigger if exists set_transactions_updated_at on public.transactions;
create trigger set_transactions_updated_at before update on public.transactions for each row execute function public.set_updated_at();

-- Seguridad (RLS) ---------------------------------------------------------

alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;

drop policy if exists "Own accounts" on public.accounts;
create policy "Own accounts" on public.accounts for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Own categories" on public.categories;
create policy "Own categories" on public.categories for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Own transactions" on public.transactions;
create policy "Own transactions" on public.transactions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.accounts, public.categories, public.transactions from anon;

-- Historial automático ----------------------------------------------------

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  table_name text not null,
  row_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_user_idx on public.audit_log(user_id, created_at desc);
alter table public.audit_log enable row level security;
drop policy if exists "Read own audit" on public.audit_log;
create policy "Read own audit" on public.audit_log for select to authenticated using (auth.uid() = user_id);
revoke all on public.audit_log from anon;

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (user_id, table_name, row_id, action, old_data, new_data)
  values (
    coalesce(new.user_id, old.user_id),
    tg_table_name,
    coalesce(new.id, old.id),
    lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists audit_accounts on public.accounts;
create trigger audit_accounts after insert or update or delete on public.accounts for each row execute function public.write_audit_log();
drop trigger if exists audit_categories on public.categories;
create trigger audit_categories after insert or update or delete on public.categories for each row execute function public.write_audit_log();
drop trigger if exists audit_transactions on public.transactions;
create trigger audit_transactions after insert or update or delete on public.transactions for each row execute function public.write_audit_log();

-- Saldos ------------------------------------------------------------------

-- security_invoker: la vista respeta el RLS de quien consulta.
create or replace view public.account_balances
with (security_invoker = on) as
select
  a.id as account_id,
  a.user_id,
  a.opening_balance,
  coalesce(sum(t.amount) filter (where t.status = 'confirmado'), 0) as movements_total,
  a.opening_balance + coalesce(sum(t.amount) filter (where t.status = 'confirmado'), 0) as balance,
  coalesce(sum(t.amount) filter (where t.status = 'pendiente'), 0) as pending_total
from public.accounts a
left join public.transactions t on t.account_id = a.id and t.deleted_at is null
group by a.id;

-- Transferencias: las 2 filas se crean o editan juntas, en una sola transacción.
create or replace function public.create_transfer(
  p_from uuid, p_to uuid, p_amount numeric, p_date date,
  p_description text default '', p_note text default '', p_status public.tx_status default 'confirmado'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_transfer uuid := gen_random_uuid();
begin
  if p_from = p_to then raise exception 'La cuenta de origen y destino deben ser distintas'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'El monto debe ser mayor que cero'; end if;

  insert into public.transactions (account_id, date, amount, kind, transfer_id, status, description, note)
  values
    (p_from, p_date, -p_amount, 'transferencia', v_transfer, p_status, p_description, p_note),
    (p_to, p_date, p_amount, 'transferencia', v_transfer, p_status, p_description, p_note);
  return v_transfer;
end;
$$;

create or replace function public.update_transfer(
  p_transfer uuid, p_from uuid, p_to uuid, p_amount numeric, p_date date,
  p_description text default '', p_note text default '', p_status public.tx_status default 'confirmado'
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_from = p_to then raise exception 'La cuenta de origen y destino deben ser distintas'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'El monto debe ser mayor que cero'; end if;

  update public.transactions
  set account_id = case when amount < 0 then p_from else p_to end,
      amount = case when amount < 0 then -p_amount else p_amount end,
      date = p_date, description = p_description, note = p_note, status = p_status
  where transfer_id = p_transfer and deleted_at is null;

  if not found then raise exception 'Transferencia no encontrada'; end if;
end;
$$;

grant execute on function public.create_transfer(uuid, uuid, numeric, date, text, text, public.tx_status) to authenticated;
grant execute on function public.update_transfer(uuid, uuid, uuid, numeric, date, text, text, public.tx_status) to authenticated;
revoke execute on function public.create_transfer(uuid, uuid, numeric, date, text, text, public.tx_status) from anon, public;
revoke execute on function public.update_transfer(uuid, uuid, uuid, numeric, date, text, text, public.tx_status) from anon, public;

-- "Total en ahorros" vs "dinero disponible": el tipo de cuenta no basta (la cuenta del día a día también es de ahorros).
alter table public.accounts add column if not exists is_savings boolean not null default false;
