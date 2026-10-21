-- Fase 3c · Plan para salir de deudas: ingreso mensual y aviso de endeudamiento alto.
-- Requiere fase3b_creditos.sql. Idempotente. Misma regla que src/shared/lib/debts.js.

-- Ingreso mensual anotado por el usuario; vacío = promedio de ingresos de los últimos 3 meses completos.
alter table public.user_settings add column if not exists monthly_income numeric(14,2) check (monthly_income is null or monthly_income >= 0);

-- Aviso una vez al mes si las cuotas de deudas superan el 35 % del ingreso mensual.
-- Pago mensual: créditos (cuota + seguros; en el alemán, capital + interés del mes) + tarjetas (mínimo estimado, al menos $10).
create or replace function public.build_debt_alert(p_user uuid default null, p_today date default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := coalesce(p_today, public.today_ec());
  v_month text := to_char(v_today, 'YYYY-MM');
  v_count integer := 0;
  v_rows integer;
  r record;
  v_payment numeric;
  v_income numeric;
begin
  for r in
    select u.id as user_id, s.monthly_income from auth.users u left join public.user_settings s on s.user_id = u.id
    where p_user is null or u.id = p_user
  loop
    select coalesce(sum(case
        when l.system = 'aleman' then least(d.debt, l.payment_amount) + round(d.debt * public.loan_monthly_rate(l.annual_rate, l.rate_type), 2)
        else least(d.debt + round(d.debt * public.loan_monthly_rate(l.annual_rate, l.rate_type), 2), l.payment_amount) end + l.monthly_fee), 0)
    into v_payment
    from public.loans l
    join public.accounts a on a.id = l.account_id
    cross join lateral (select public.loan_debt_before(l.account_id, v_today + 1) as debt) d
    where l.user_id = r.user_id and l.archived_at is null and a.archived_at is null and d.debt > 0;

    v_payment := v_payment + coalesce((
      select sum(least(-b.balance, greatest(round(-b.balance * a.min_payment_pct / 100, 2), 10)))
      from public.accounts a join public.account_balances b on b.account_id = a.id
      where a.user_id = r.user_id and a.type = 'tarjeta_credito' and a.archived_at is null and b.balance < 0), 0);

    v_income := r.monthly_income;
    if v_income is null then
      select avg(total) into v_income from (
        select sum(t.amount) as total from public.transactions t
        where t.user_id = r.user_id and t.kind = 'ingreso' and t.status = 'confirmado' and t.deleted_at is null
          and t.date >= (date_trunc('month', v_today) - interval '3 months')::date and t.date < date_trunc('month', v_today)::date
        group by date_trunc('month', t.date)
      ) m where total > 0;
    end if;

    if coalesce(v_income, 0) > 0 and v_payment / v_income * 100 > 35 then
      insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
      values (r.user_id, 'deuda-alta', 'Endeudamiento alto',
        format('Tus cuotas de deudas suman %s al mes: el %s%% de tu ingreso (%s). Lo sano es hasta 30–35 %%.',
          public.fmt_usd(v_payment), round(v_payment / v_income * 100), public.fmt_usd(v_income)),
        '/deudas', 'deuda-alta:' || v_month)
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

  -- 2) Tarjetas, créditos y endeudamiento.
  v_count := v_count + public.build_card_alerts(p_user, v_today);
  v_count := v_count + public.build_loan_alerts(p_user, v_today);
  v_count := v_count + public.build_debt_alert(p_user, v_today);

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

revoke execute on function public.build_debt_alert(uuid, date) from public, anon, authenticated;
revoke execute on function public.build_alerts(uuid, date) from public, anon, authenticated;
