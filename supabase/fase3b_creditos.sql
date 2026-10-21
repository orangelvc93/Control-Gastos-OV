-- Fase 3b · Factores de diferido del banco y créditos / préstamos.
-- Requiere fase3_tarjetas.sql. Idempotente (el tipo de cuenta 'prestamo' se agrega aparte, ver abajo).
-- Diseño: conocimiento/Créditos y préstamos.md. Mismos cálculos que src/shared/lib/loans.js y cards.js.

-- 1) Factores de diferido con intereses --------------------------------------------
-- Los bancos publican un factor por plazo (interés total del diferido = monto × factor). Ej.: {"3": 2.63, "12": 8.76}.
alter table public.accounts add column if not exists deferral_factors jsonb not null default '{}'::jsonb;

-- Cuotas de un diferido (centavos → dólares al final).
-- Con factor del banco: capital e interés total repartidos en cuotas iguales (el sobrante en la última).
-- Sin factor: cuotas iguales sin interés, o sistema francés con la tasa de la tarjeta.
create or replace function public.card_installment_rows(p_plan uuid)
returns table (n int, cut date, capital numeric, interest numeric)
language plpgsql stable set search_path = '' as $$
declare
  v_plan public.card_installments;
  v_acct public.accounts;
  v_factor numeric;
  v_rate numeric;
  v_balance numeric;
  v_payment numeric;
  v_interest numeric;
  v_capital numeric;
  v_total_interest numeric;
begin
  select * into v_plan from public.card_installments where id = p_plan;
  select * into v_acct from public.accounts where id = v_plan.account_id;
  v_balance := v_plan.principal * 100;

  if v_plan.with_interest then
    v_factor := nullif((v_acct.deferral_factors ->> v_plan.months::text)::numeric, 0);
  end if;

  if v_factor is not null then
    v_total_interest := round(v_balance * v_factor / 100);
    for i in 1..v_plan.months loop
      n := i;
      cut := public.card_cut(v_plan.first_cut, i - 1, v_acct.statement_day);
      capital := (case when i = v_plan.months then v_balance - floor(v_balance / v_plan.months) * (v_plan.months - 1) else floor(v_balance / v_plan.months) end) / 100;
      interest := (case when i = v_plan.months then v_total_interest - floor(v_total_interest / v_plan.months) * (v_plan.months - 1) else floor(v_total_interest / v_plan.months) end) / 100;
      return next;
    end loop;
    return;
  end if;

  if v_plan.with_interest and coalesce(v_acct.interest_rate, 0) > 0 then
    v_rate := case when v_acct.rate_type = 'efectiva'
      then power(1 + v_acct.interest_rate / 100, 1.0 / 12) - 1
      else v_acct.interest_rate / 100 / 12 end;
  end if;
  v_payment := case when v_rate is null then floor(v_balance / v_plan.months)
    else round(v_balance * v_rate / (1 - power(1 + v_rate, -v_plan.months))) end;

  for i in 1..v_plan.months loop
    v_interest := case when v_rate is null then 0 else round(v_balance * v_rate) end;
    v_capital := case when i = v_plan.months then v_balance else least(v_balance, v_payment - v_interest) end;
    v_balance := v_balance - v_capital;
    n := i;
    cut := public.card_cut(v_plan.first_cut, i - 1, v_acct.statement_day);
    capital := v_capital / 100;
    interest := v_interest / 100;
    return next;
  end loop;
end;
$$;

create or replace function public.ensure_interest_category(p_user uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  insert into public.categories (user_id, name, kind, is_system)
  values (p_user, 'Intereses y comisiones', 'gasto', true)
  on conflict (user_id, kind, name) do nothing;
  select id into v_id from public.categories where user_id = p_user and kind = 'gasto' and name = 'Intereses y comisiones';
  return v_id;
end;
$$;

-- Intereses de diferidos (ahora también con factor del banco).
create or replace function public.generate_card_interest(p_user uuid default null, p_today date default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := coalesce(p_today, public.today_ec());
  v_plan record;
  v_row record;
  v_count integer := 0;
  v_rows integer;
begin
  for v_plan in
    select p.*, s.since, a.opening_date, a.statement_day
    from public.card_installments p
    join public.accounts a on a.id = p.account_id
    cross join lateral (select since from public.card_active_plans(p.account_id) x where x.id = p.id) s
    where p.with_interest and a.statement_day is not null
      and (coalesce(a.interest_rate, 0) > 0 or (a.deferral_factors ->> p.months::text) is not null)
      and (p_user is null or p.user_id = p_user)
  loop
    for v_row in
      select * from public.card_installment_rows(v_plan.id) r
      where r.interest > 0 and r.cut <= v_today and r.cut >= greatest(v_plan.since, v_plan.opening_date)
    loop
      insert into public.transactions (user_id, account_id, date, amount, kind, category_id, status, description, note, installment_id, installment_no)
      values (v_plan.user_id, v_plan.account_id, v_row.cut, -v_row.interest, 'gasto', public.ensure_interest_category(v_plan.user_id), 'confirmado',
        format('Interés diferido: %s (%s/%s)', coalesce(nullif(v_plan.description, ''), 'compra'), v_row.n, v_plan.months),
        'Registrado automáticamente', v_plan.id, v_row.n)
      on conflict (installment_id, installment_no) where installment_id is not null do nothing;
      get diagnostics v_rows = row_count; v_count := v_count + v_rows;
    end loop;
  end loop;
  return v_count;
end;
$$;

-- 2) Créditos y préstamos -------------------------------------------------------------
-- Cada crédito es una cuenta de tipo 'prestamo' (saldo negativo = lo que debes) + su ficha en loans.
-- Cada cuota se registra sola el día de pago, desde la cuenta de pago:
--   interés → gasto (Intereses y comisiones) · capital → transferencia hacia el crédito (baja la deuda, no es gasto)
--   seguros/cargos fijos → gasto.
-- El interés se calcula sobre la deuda real del crédito antes de esa cuota (así un abono extra se refleja solo).
-- payment_amount: cuota sin seguros (francés) o capital fijo por cuota (alemán). Un abono "reducir cuota" la actualiza.
create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid not null,
  kind text not null default 'bancario' check (kind in ('bancario', 'consumo', 'vehicular', 'hipotecario', 'personal')),
  principal numeric(14,2) not null check (principal > 0),
  annual_rate numeric(8,4) not null default 0 check (annual_rate >= 0),
  rate_type public.rate_type not null default 'nominal',
  term_months smallint not null check (term_months between 1 and 480),
  system text not null default 'frances' check (system in ('frances', 'aleman')),
  first_payment_date date not null,
  payment_day smallint not null check (payment_day between 1 and 31),
  paid_before smallint not null default 0 check (paid_before >= 0),
  payment_amount numeric(14,2) not null check (payment_amount > 0),
  monthly_fee numeric(14,2) not null default 0 check (monthly_fee >= 0),
  pay_account_id uuid not null,
  auto_confirm boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (account_id),
  foreign key (account_id, user_id) references public.accounts(id, user_id) on delete cascade,
  foreign key (pay_account_id, user_id) references public.accounts(id, user_id),
  check (paid_before < term_months)
);

drop trigger if exists set_loans_updated_at on public.loans;
create trigger set_loans_updated_at before update on public.loans for each row execute function public.set_updated_at();
drop trigger if exists audit_loans on public.loans;
create trigger audit_loans after insert or update or delete on public.loans for each row execute function public.write_audit_log();
alter table public.loans enable row level security;
drop policy if exists "Own loans" on public.loans;
create policy "Own loans" on public.loans for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.loans from anon;

alter table public.transactions add column if not exists loan_id uuid;
alter table public.transactions add column if not exists loan_no smallint;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_loan_fk') then
    alter table public.transactions
      add constraint transactions_loan_fk foreign key (loan_id, user_id) references public.loans(id, user_id) on delete cascade;
  end if;
end $$;
create index if not exists transactions_loan_idx on public.transactions(loan_id, loan_no) where loan_id is not null;

create or replace function public.loan_monthly_rate(p_annual numeric, p_type public.rate_type)
returns numeric language sql immutable set search_path = '' as $$
  select case when coalesce(p_annual, 0) = 0 then 0
    when p_type = 'efectiva' then power(1 + p_annual / 100, 1.0 / 12) - 1
    else p_annual / 100 / 12 end;
$$;

-- Deuda del crédito (positiva) antes de una fecha: saldo inicial + movimientos confirmados anteriores.
create or replace function public.loan_debt_before(p_account uuid, p_date date)
returns numeric language sql stable set search_path = '' as $$
  select -(a.opening_balance + coalesce((
    select sum(t.amount) from public.transactions t
    where t.account_id = a.id and t.deleted_at is null and t.status = 'confirmado'
      and t.date >= a.opening_date and t.date < p_date), 0))
  from public.accounts a where a.id = p_account;
$$;

create or replace function public.generate_loan_installments(p_user uuid default null, p_today date default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := coalesce(p_today, public.today_ec());
  v_loan record;
  v_rate numeric;
  v_j int;
  v_no int;
  v_date date;
  v_debt numeric;
  v_interest numeric;
  v_capital numeric;
  v_status public.tx_status;
  v_transfer uuid;
  v_label text;
  v_count integer := 0;
begin
  for v_loan in
    select l.*, a.name as loan_name, a.opening_date
    from public.loans l
    join public.accounts a on a.id = l.account_id
    where l.archived_at is null and a.archived_at is null and (p_user is null or l.user_id = p_user)
  loop
    v_rate := public.loan_monthly_rate(v_loan.annual_rate, v_loan.rate_type);
    v_status := case when v_loan.auto_confirm then 'confirmado' else 'pendiente' end;
    v_j := 1;
    loop
      v_no := v_loan.paid_before + v_j;
      exit when v_no > v_loan.term_months;
      v_date := public.card_cut(v_loan.first_payment_date, v_j - 1, v_loan.payment_day);
      exit when v_date > v_today;
      v_j := v_j + 1;
      -- Solo cuotas desde que el crédito está en la app, y nunca dos veces la misma.
      continue when v_date < greatest(v_loan.opening_date, (v_loan.created_at at time zone 'America/Guayaquil')::date);
      continue when exists (select 1 from public.transactions where loan_id = v_loan.id and loan_no = v_no);

      v_debt := public.loan_debt_before(v_loan.account_id, v_date);
      exit when v_debt <= 0;
      v_interest := round(v_debt * v_rate, 2);
      v_capital := case
        when v_no = v_loan.term_months then v_debt
        when v_loan.system = 'aleman' then least(v_debt, v_loan.payment_amount)
        else least(v_debt, greatest(0, v_loan.payment_amount - v_interest)) end;
      v_label := format('%s (%s/%s)', v_loan.loan_name, v_no, v_loan.term_months);

      if v_interest > 0 then
        insert into public.transactions (user_id, account_id, date, amount, kind, category_id, status, description, note, loan_id, loan_no)
        values (v_loan.user_id, v_loan.pay_account_id, v_date, -v_interest, 'gasto', public.ensure_interest_category(v_loan.user_id), v_status,
          'Interés ' || v_label, 'Registrado automáticamente', v_loan.id, v_no);
      end if;
      if v_capital > 0 then
        v_transfer := gen_random_uuid();
        insert into public.transactions (user_id, account_id, date, amount, kind, transfer_id, status, description, note, loan_id, loan_no)
        values
          (v_loan.user_id, v_loan.pay_account_id, v_date, -v_capital, 'transferencia', v_transfer, v_status, 'Capital ' || v_label, 'Registrado automáticamente', v_loan.id, v_no),
          (v_loan.user_id, v_loan.account_id, v_date, v_capital, 'transferencia', v_transfer, v_status, 'Capital ' || v_label, 'Registrado automáticamente', v_loan.id, v_no);
      end if;
      if v_loan.monthly_fee > 0 then
        insert into public.transactions (user_id, account_id, date, amount, kind, category_id, status, description, note, loan_id, loan_no)
        values (v_loan.user_id, v_loan.pay_account_id, v_date, -v_loan.monthly_fee, 'gasto', public.ensure_interest_category(v_loan.user_id), v_status,
          'Seguros y cargos ' || v_label, 'Registrado automáticamente', v_loan.id, v_no);
      end if;

      insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
      values (v_loan.user_id, 'credito-registrado',
        case when v_status = 'pendiente' then 'Confirma la cuota: ' else 'Cuota registrada: ' end || v_loan.loan_name,
        format('Cuota %s/%s del %s: %s (interés %s, capital %s%s).', v_no, v_loan.term_months, to_char(v_date, 'DD/MM'),
          public.fmt_usd(v_interest + v_capital + v_loan.monthly_fee), public.fmt_usd(v_interest), public.fmt_usd(v_capital),
          case when v_loan.monthly_fee > 0 then ', seguros ' || public.fmt_usd(v_loan.monthly_fee) else '' end),
        '/cuentas/' || v_loan.account_id, 'credito:' || v_loan.id || ':' || v_no)
      on conflict (user_id, dedupe_key) do nothing;
      v_count := v_count + 1;
    end loop;
  end loop;
  return v_count;
end;
$$;

-- Aviso de la próxima cuota, N días antes.
create or replace function public.build_loan_alerts(p_user uuid default null, p_today date default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := coalesce(p_today, public.today_ec());
  v_loan record;
  v_no int;
  v_date date;
  v_debt numeric;
  v_interest numeric;
  v_capital numeric;
  v_count integer := 0;
  v_rows integer;
begin
  for v_loan in
    select l.*, a.name as loan_name, coalesce(s.notify_days_before, 2) as days_before
    from public.loans l
    join public.accounts a on a.id = l.account_id
    left join public.user_settings s on s.user_id = l.user_id
    where l.archived_at is null and a.archived_at is null and (p_user is null or l.user_id = p_user)
  loop
    for j in 1..(v_loan.term_months - v_loan.paid_before) loop
      v_date := public.card_cut(v_loan.first_payment_date, j - 1, v_loan.payment_day);
      continue when v_date <= v_today;
      v_no := v_loan.paid_before + j;
      if v_date - v_today <= v_loan.days_before then
        v_debt := public.loan_debt_before(v_loan.account_id, v_today + 1);
        exit when v_debt <= 0;
        v_interest := round(v_debt * public.loan_monthly_rate(v_loan.annual_rate, v_loan.rate_type), 2);
        v_capital := case when v_loan.system = 'aleman' then least(v_debt, v_loan.payment_amount)
          else least(v_debt, greatest(0, v_loan.payment_amount - v_interest)) end;
        insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
        values (v_loan.user_id, 'credito-proximo',
          case when v_date = v_today + 1 then 'Mañana: cuota de ' else 'Próxima cuota: ' end || v_loan.loan_name,
          format('Cuota %s/%s el %s: unos %s.', v_no, v_loan.term_months, to_char(v_date, 'DD/MM'), public.fmt_usd(v_interest + v_capital + v_loan.monthly_fee)),
          '/cuentas/' || v_loan.account_id, 'credito-proximo:' || v_loan.id || ':' || v_no)
        on conflict (user_id, dedupe_key) do nothing;
        get diagnostics v_rows = row_count; v_count := v_count + v_rows;
      end if;
      exit;
    end loop;
  end loop;
  return v_count;
end;
$$;

-- build_alerts y la tarea diaria, ahora con créditos.
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

  -- 2) Tarjetas y créditos.
  v_count := v_count + public.build_card_alerts(p_user, v_today);
  v_count := v_count + public.build_loan_alerts(p_user, v_today);

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

create or replace function public.run_daily_jobs(p_user uuid default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_generated integer;
  v_interest integer;
  v_loans integer;
  v_alerts integer;
  v_sent integer;
begin
  v_generated := public.generate_due_recurring(p_user);
  v_interest := public.generate_card_interest(p_user);
  v_loans := public.generate_loan_installments(p_user);
  v_alerts := public.build_alerts(p_user);
  v_sent := public.send_telegram_pending(p_user);
  return jsonb_build_object('registrados', v_generated + v_interest + v_loans, 'avisos', v_alerts, 'telegram', v_sent);
end;
$$;

revoke execute on function public.ensure_interest_category(uuid) from public, anon, authenticated;
revoke execute on function public.generate_card_interest(uuid, date) from public, anon, authenticated;
revoke execute on function public.generate_loan_installments(uuid, date) from public, anon, authenticated;
revoke execute on function public.build_loan_alerts(uuid, date) from public, anon, authenticated;
revoke execute on function public.build_alerts(uuid, date) from public, anon, authenticated;
revoke execute on function public.run_daily_jobs(uuid) from public, anon, authenticated;

-- 3) Tipo de cuenta 'prestamo' ----------------------------------------------------------
-- Postgres no deja usar un valor nuevo de un enum en la misma transacción en que se crea; no se usa en este archivo.
alter type public.account_type add value if not exists 'prestamo';
