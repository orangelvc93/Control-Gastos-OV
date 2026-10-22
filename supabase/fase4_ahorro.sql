-- Fase 4 · Ahorro: intereses anotados, presupuesto 50/30/20, fondo de emergencia y metas.
-- Requiere fase3c_deudas.sql. Idempotente. Diseño: conocimiento/Intereses.md, Plan de ahorro.md, Metas de ahorro.md.

-- 1) Intereses ---------------------------------------------------------------------
-- El interés lo anota el usuario cada mes (lo que llegó, neto) como ingreso "Rendimientos financieros".
-- interest_month (primer día del mes) e interest_account (cuenta que lo generó) lo enlazan con su cuenta,
-- aunque el dinero llegue a otra cuenta (cuando no capitaliza).
alter table public.accounts add column if not exists earns_interest boolean not null default false;
alter table public.accounts add column if not exists withholding_pct numeric(5,2) check (withholding_pct is null or (withholding_pct >= 0 and withholding_pct < 100));
alter table public.transactions add column if not exists interest_month date;
alter table public.transactions add column if not exists interest_account uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_interest_account_fk') then
    alter table public.transactions
      add constraint transactions_interest_account_fk foreign key (interest_account, user_id) references public.accounts(id, user_id) on delete cascade;
  end if;
end $$;
create index if not exists transactions_interest_idx on public.transactions(interest_account, interest_month) where interest_account is not null;

-- 2) Presupuesto ---------------------------------------------------------------------
-- Cada categoría de gasto es necesidad o gusto (el 50/30/20) y puede tener un presupuesto mensual.
alter table public.categories add column if not exists budget_group text check (budget_group is null or budget_group in ('necesidad', 'gusto'));
alter table public.categories add column if not exists monthly_budget numeric(14,2) check (monthly_budget is null or monthly_budget > 0);

alter table public.user_settings add column if not exists plan_needs_pct numeric(5,2) not null default 50;
alter table public.user_settings add column if not exists plan_wants_pct numeric(5,2) not null default 30;
alter table public.user_settings add column if not exists plan_savings_pct numeric(5,2) not null default 20;
alter table public.user_settings add column if not exists emergency_account_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_settings_emergency_fk') then
    alter table public.user_settings
      add constraint user_settings_emergency_fk foreign key (emergency_account_id, user_id) references public.accounts(id, user_id) on delete set null (emergency_account_id);
  end if;
end $$;

-- 3) Metas -----------------------------------------------------------------------------
-- Lo ahorrado es el saldo de la cuenta asociada; sin cuenta, lo que anota el usuario (manual_saved).
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  target numeric(14,2) not null check (target > 0),
  deadline date,
  account_id uuid,
  manual_saved numeric(14,2) not null default 0 check (manual_saved >= 0),
  start_date date not null default current_date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (account_id, user_id) references public.accounts(id, user_id) on delete set null (account_id)
);

drop trigger if exists set_goals_updated_at on public.goals;
create trigger set_goals_updated_at before update on public.goals for each row execute function public.set_updated_at();
drop trigger if exists audit_goals on public.goals;
create trigger audit_goals after insert or update or delete on public.goals for each row execute function public.write_audit_log();
alter table public.goals enable row level security;
drop policy if exists "Own goals" on public.goals;
create policy "Own goals" on public.goals for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.goals from anon;

-- 4) Avisos -----------------------------------------------------------------------------
create or replace function public.account_balance_at(p_account uuid, p_date date)
returns numeric language sql stable set search_path = '' as $$
  select a.opening_balance + coalesce((
    select sum(t.amount) from public.transactions t
    where t.account_id = a.id and t.deleted_at is null and t.status = 'confirmado'
      and t.date >= a.opening_date and t.date <= p_date), 0)
  from public.accounts a where a.id = p_account;
$$;

create or replace function public.build_savings_alerts(p_user uuid default null, p_today date default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := coalesce(p_today, public.today_ec());
  v_month date := date_trunc('month', v_today)::date;
  v_prev date := (date_trunc('month', v_today) - interval '1 month')::date;
  v_month_names text[] := array['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  v_count integer := 0;
  v_rows integer;
  r record;
  v_saved numeric;
  v_expected numeric;
begin
  -- Recordatorio de anotar el interés del mes anterior (días 1 a 7), si la cuenta ya existía ese mes.
  if extract(day from v_today) <= 7 then
    insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
    select a.user_id, 'interes-pendiente', 'Anota el interés de ' || a.name,
      format('¿Cuánto te pagó %s en %s? Anótalo en la cuenta para llevar el control de lo ganado.', a.name, v_month_names[extract(month from v_prev)::int]),
      '/cuentas/' || a.id, 'interes:' || a.id || ':' || v_prev
    from public.accounts a
    where a.earns_interest and a.archived_at is null and a.opening_date < v_month
      and (p_user is null or a.user_id = p_user)
      and not exists (select 1 from public.transactions t where t.interest_account = a.id and t.interest_month = v_prev and t.deleted_at is null)
    on conflict (user_id, dedupe_key) do nothing;
    get diagnostics v_rows = row_count; v_count := v_count + v_rows;
  end if;

  -- Presupuesto por categoría: aviso al 80 % y al superarlo (una vez por mes y categoría).
  for r in
    select c.id, c.user_id, c.name, c.monthly_budget, -coalesce(sum(t.amount), 0) as spent
    from public.categories c
    left join public.transactions t on t.category_id = c.id and t.deleted_at is null and t.status = 'confirmado'
      and t.kind = 'gasto' and t.date >= v_month and t.date <= v_today
    where c.monthly_budget is not null and c.archived_at is null and (p_user is null or c.user_id = p_user)
    group by c.id
    having -coalesce(sum(t.amount), 0) >= c.monthly_budget * 0.8
  loop
    insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
    values (r.user_id,
      case when r.spent > r.monthly_budget then 'presupuesto-superado' else 'presupuesto-80' end,
      case when r.spent > r.monthly_budget then 'Presupuesto superado: ' else 'Cerca del presupuesto: ' end || r.name,
      format('Llevas %s de %s este mes (%s%%).', public.fmt_usd(r.spent), public.fmt_usd(r.monthly_budget), round(r.spent / r.monthly_budget * 100)),
      '/presupuesto',
      case when r.spent > r.monthly_budget then 'presupuesto-superado:' else 'presupuesto-80:' end || r.id || ':' || v_month)
    on conflict (user_id, dedupe_key) do nothing;
    get diagnostics v_rows = row_count; v_count := v_count + v_rows;
  end loop;

  -- Metas atrasadas: lo ahorrado va más de un 10 % del objetivo por debajo de lo esperado a esta fecha (una vez por mes).
  for r in
    select g.* from public.goals g
    where g.archived_at is null and g.deadline is not null and g.deadline > g.start_date and (p_user is null or g.user_id = p_user)
  loop
    v_saved := case when r.account_id is not null then greatest(0, public.account_balance_at(r.account_id, v_today)) else r.manual_saved end;
    v_expected := r.target * least(1, greatest(0, (v_today - r.start_date)::numeric / (r.deadline - r.start_date)));
    if v_saved < r.target and v_expected - v_saved > r.target * 0.1 then
      insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
      values (r.user_id, 'meta-atrasada', 'Meta atrasada: ' || r.name,
        format('Llevas %s de %s; a esta fecha deberías tener unos %s.', public.fmt_usd(v_saved), public.fmt_usd(r.target), public.fmt_usd(v_expected)),
        '/metas', 'meta-atrasada:' || r.id || ':' || v_month)
      on conflict (user_id, dedupe_key) do nothing;
      get diagnostics v_rows = row_count; v_count := v_count + v_rows;
    end if;
  end loop;

  return v_count;
end;
$$;

create or replace function public.build_alerts(p_user uuid default null, p_today date default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := coalesce(p_today, public.today_ec());
  v_month text := to_char(v_today, 'YYYY-MM');
  v_count integer := 0;
  v_rows integer;
begin
  -- 1) Frecuentes que vienen en los próximos N días.
  insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
  select i.user_id, 'frecuente-proximo',
    case when d = v_today + 1 then 'Mañana: ' else 'Próximo: ' end || i.name,
    format('%s %s el %s.', case when i.kind = 'ingreso' then 'Te llegan' else 'Toca pagar' end, public.fmt_usd(i.amount), to_char(d, 'DD/MM')),
    '/gestion',
    'proximo:' || i.id || ':' || d
  from public.recurring_items i
  left join public.user_settings s on s.user_id = i.user_id
  cross join lateral public.recurring_occurrences(i.frequency, i.start_date, i.end_date, v_today + 1, v_today + coalesce(s.notify_days_before, 2)) d
  where i.archived_at is null and (p_user is null or i.user_id = p_user)
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics v_rows = row_count; v_count := v_count + v_rows;

  -- 2) Tarjetas, créditos, endeudamiento, intereses, presupuestos y metas.
  v_count := v_count + public.build_card_alerts(p_user, v_today);
  v_count := v_count + public.build_loan_alerts(p_user, v_today);
  v_count := v_count + public.build_debt_alert(p_user, v_today);
  v_count := v_count + public.build_savings_alerts(p_user, v_today);

  -- 3) Gastos del mes mayores que los ingresos.
  insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
  select t.user_id, 'mes-negativo', 'Este mes gastas más de lo que entra',
    format('Gastos %s · Ingresos %s en %s.', public.fmt_usd(coalesce(sum(t.amount) filter (where t.kind = 'gasto'), 0)), public.fmt_usd(coalesce(sum(t.amount) filter (where t.kind = 'ingreso'), 0)), v_month),
    '/movimientos', 'mes-negativo:' || v_month
  from public.transactions t
  where t.deleted_at is null and t.status = 'confirmado' and to_char(t.date, 'YYYY-MM') = v_month
    and (p_user is null or t.user_id = p_user)
  group by t.user_id
  having -coalesce(sum(t.amount) filter (where t.kind = 'gasto'), 0) > coalesce(sum(t.amount) filter (where t.kind = 'ingreso'), 0)
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics v_rows = row_count; v_count := v_count + v_rows;

  return v_count;
end;
$$;

revoke execute on function public.build_savings_alerts(uuid, date) from public, anon, authenticated;
revoke execute on function public.build_alerts(uuid, date) from public, anon, authenticated;
