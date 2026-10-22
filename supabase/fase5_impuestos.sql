-- Fase 5 · Impuestos: datos de la factura en los gastos deducibles, configuración del SRI por año y aviso de facturas incompletas.
-- Requiere fase4c_ingreso_disponible.sql. Idempotente. Diseño: conocimiento/Facturas y gastos deducibles.md,
-- Configuración por año (SRI).md y Exportación para el SRI.md.
-- Sin adjuntos: no se guardan fotos, PDF ni XML, solo los datos.

-- 1) Factura de un gasto deducible ----------------------------------------------------
alter table public.transactions add column if not exists invoice_ruc text check (invoice_ruc is null or invoice_ruc ~ '^[0-9]{10,13}$');
alter table public.transactions add column if not exists invoice_number text;
alter table public.transactions add column if not exists invoice_base numeric(14,2) check (invoice_base is null or invoice_base >= 0);
alter table public.transactions add column if not exists invoice_iva numeric(14,2) check (invoice_iva is null or invoice_iva >= 0);
create index if not exists transactions_deductible_idx on public.transactions(user_id, date) where deductible and deleted_at is null;

-- 2) Configuración del SRI por año fiscal ------------------------------------------------
-- Ningún valor del SRI va fijo en el código: el usuario los revisa y edita cada año.
-- Rebaja por gastos personales = rebate_pct % del menor valor entre los gastos deducibles del año
-- y (canastas según cargas familiares × valor de la canasta básica).
create table if not exists public.tax_years (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  year smallint not null check (year between 2000 and 2100),
  basic_fraction numeric(14,2),
  basket_value numeric(14,2),
  rebate_pct numeric(5,2) not null default 18 check (rebate_pct >= 0 and rebate_pct <= 100),
  dependents smallint not null default 0 check (dependents between 0 and 20),
  catastrophic boolean not null default false,
  -- canastas permitidas según el número de cargas familiares ("5" = cinco o más)
  basket_limits jsonb not null default '{"0": 7, "1": 9, "2": 11, "3": 14, "4": 17, "5": 20}'::jsonb,
  catastrophic_baskets smallint not null default 20,
  interest_withholding_pct numeric(5,2) not null default 2 check (interest_withholding_pct >= 0 and interest_withholding_pct < 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, year)
);

drop trigger if exists set_tax_years_updated_at on public.tax_years;
create trigger set_tax_years_updated_at before update on public.tax_years for each row execute function public.set_updated_at();
drop trigger if exists audit_tax_years on public.tax_years;
create trigger audit_tax_years after insert or update or delete on public.tax_years for each row execute function public.write_audit_log();
alter table public.tax_years enable row level security;
drop policy if exists "Own tax years" on public.tax_years;
create policy "Own tax years" on public.tax_years for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.tax_years from anon;

-- 3) Aviso: gastos deducibles del mes anterior sin RUC o sin número de factura (días 1 a 7) --
create or replace function public.build_tax_alerts(p_user uuid default null, p_today date default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := coalesce(p_today, public.today_ec());
  v_prev date := (date_trunc('month', v_today) - interval '1 month')::date;
  v_month_names text[] := array['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  v_rows integer := 0;
begin
  if extract(day from v_today) > 7 then
    return 0;
  end if;
  insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
  select t.user_id, 'factura-incompleta', 'Facturas por completar',
    format('Tienes %s gasto(s) deducible(s) de %s sin RUC o sin número de factura. Complétalos para tu declaración.',
      count(*), v_month_names[extract(month from v_prev)::int]),
    '/impuestos', 'factura-incompleta:' || v_prev
  from public.transactions t
  where t.deductible and t.kind = 'gasto' and t.deleted_at is null and t.status = 'confirmado'
    and t.date >= v_prev and t.date < date_trunc('month', v_today)::date
    and (t.invoice_ruc is null or coalesce(trim(t.invoice_number), '') = '')
    and (p_user is null or t.user_id = p_user)
  group by t.user_id
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics v_rows = row_count;
  return v_rows;
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

  -- 2) Tarjetas, créditos, endeudamiento, intereses, presupuestos, metas e impuestos.
  v_count := v_count + public.build_card_alerts(p_user, v_today);
  v_count := v_count + public.build_loan_alerts(p_user, v_today);
  v_count := v_count + public.build_debt_alert(p_user, v_today);
  v_count := v_count + public.build_savings_alerts(p_user, v_today);
  v_count := v_count + public.build_tax_alerts(p_user, v_today);

  -- 3) Gastos del mes mayores que los ingresos disponibles (los aportes directos a un fondo no cuentan).
  insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
  select t.user_id, 'mes-negativo', 'Este mes gastas más de lo que entra',
    format('Gastos %s · Ingresos %s en %s.', public.fmt_usd(coalesce(sum(t.amount) filter (where t.kind = 'gasto'), 0)),
      public.fmt_usd(coalesce(sum(t.amount) filter (where public.is_available_income(t.kind, t.category_id)), 0)), v_month),
    '/movimientos', 'mes-negativo:' || v_month
  from public.transactions t
  where t.deleted_at is null and t.status = 'confirmado' and to_char(t.date, 'YYYY-MM') = v_month
    and (p_user is null or t.user_id = p_user)
  group by t.user_id
  having -coalesce(sum(t.amount) filter (where t.kind = 'gasto'), 0) > coalesce(sum(t.amount) filter (where public.is_available_income(t.kind, t.category_id)), 0)
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics v_rows = row_count; v_count := v_count + v_rows;

  return v_count;
end;
$$;

revoke execute on function public.build_tax_alerts(uuid, date) from public, anon, authenticated;
revoke execute on function public.build_alerts(uuid, date) from public, anon, authenticated;
