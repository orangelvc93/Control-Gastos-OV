-- Gastos e ingresos frecuentes (recurrentes). Diseño: conocimiento/Movimientos recurrentes.md
-- Por ahora se registran con un toque desde la app; la generación automática diaria (pg_cron) llega en la fase 2.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'recurring_frequency') then
    create type public.recurring_frequency as enum ('semanal', 'quincenal', 'mensual', 'anual');
  end if;
end $$;

create table if not exists public.recurring_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  kind public.tx_kind not null check (kind in ('ingreso', 'gasto', 'transferencia')),
  amount numeric(14,2) not null check (amount > 0),
  account_id uuid not null,
  to_account_id uuid,
  category_id uuid,
  frequency public.recurring_frequency not null,
  start_date date not null,
  end_date date check (end_date is null or end_date >= start_date),
  note text not null default '',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (account_id, user_id) references public.accounts(id, user_id),
  foreign key (to_account_id, user_id) references public.accounts(id, user_id),
  foreign key (category_id, user_id) references public.categories(id, user_id),
  constraint recurring_kind_rules check (
    (kind = 'transferencia' and to_account_id is not null and to_account_id <> account_id and category_id is null)
    or (kind in ('ingreso', 'gasto') and category_id is not null and to_account_id is null)
  )
);

create index if not exists recurring_items_user_idx on public.recurring_items(user_id);

drop trigger if exists set_recurring_items_updated_at on public.recurring_items;
create trigger set_recurring_items_updated_at before update on public.recurring_items for each row execute function public.set_updated_at();
drop trigger if exists audit_recurring_items on public.recurring_items;
create trigger audit_recurring_items after insert or update or delete on public.recurring_items for each row execute function public.write_audit_log();

alter table public.recurring_items enable row level security;
drop policy if exists "Own recurring items" on public.recurring_items;
create policy "Own recurring items" on public.recurring_items for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.recurring_items from anon;

-- Cada movimiento puede indicar de qué frecuente y de qué fecha (ocurrencia) viene.
alter table public.transactions add column if not exists recurring_id uuid;
alter table public.transactions add column if not exists occurrence_date date;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_recurring_fk') then
    alter table public.transactions
      add constraint transactions_recurring_fk foreign key (recurring_id, user_id) references public.recurring_items(id, user_id);
  end if;
end $$;
create index if not exists transactions_recurring_idx on public.transactions(recurring_id, occurrence_date) where recurring_id is not null;

-- create_transfer acepta ahora el frecuente de origen (parámetros opcionales).
drop function if exists public.create_transfer(uuid, uuid, numeric, date, text, text, public.tx_status);
create or replace function public.create_transfer(
  p_from uuid, p_to uuid, p_amount numeric, p_date date,
  p_description text default '', p_note text default '', p_status public.tx_status default 'confirmado',
  p_recurring_id uuid default null, p_occurrence_date date default null
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

  insert into public.transactions (account_id, date, amount, kind, transfer_id, status, description, note, recurring_id, occurrence_date)
  values
    (p_from, p_date, -p_amount, 'transferencia', v_transfer, p_status, p_description, p_note, p_recurring_id, p_occurrence_date),
    (p_to, p_date, p_amount, 'transferencia', v_transfer, p_status, p_description, p_note, p_recurring_id, p_occurrence_date);
  return v_transfer;
end;
$$;

grant execute on function public.create_transfer(uuid, uuid, numeric, date, text, text, public.tx_status, uuid, date) to authenticated;
revoke execute on function public.create_transfer(uuid, uuid, numeric, date, text, text, public.tx_status, uuid, date) from anon, public;
