-- Fase 3 · Tarjetas de crédito: diferidos, estados de cuenta, intereses de diferidos y avisos de pago.
-- Requiere fase2_automatizacion.sql y fase2b_push.sql. Idempotente.
-- Diseño: conocimiento/Tarjetas de crédito.md. Los cálculos son los mismos que src/shared/lib/cards.js.

-- Pago mínimo estimado cuando no anotas el del estado de cuenta (% de lo que debes pagar en ese corte).
alter table public.accounts add column if not exists min_payment_pct numeric(5,2) not null default 10
  check (min_payment_pct >= 0 and min_payment_pct <= 100);

-- Diferidos ----------------------------------------------------------------------
-- La compra es un gasto normal por el monto total (sube la deuda y cuenta en su categoría el día de la compra);
-- el diferido solo dice cómo se cobra: una cuota de capital por corte desde first_cut.
-- in_opening: diferido que ya tenías al empezar; su saldo ya está en el saldo inicial de la tarjeta (no tiene compra).
create table if not exists public.card_installments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid not null,
  transaction_id uuid,
  description text not null default '',
  principal numeric(14,2) not null check (principal > 0),
  months smallint not null check (months between 2 and 60),
  with_interest boolean not null default false,
  first_cut date not null,
  in_opening boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (account_id, user_id) references public.accounts(id, user_id),
  check (in_opening or transaction_id is not null)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'card_installments_transaction_fk') then
    alter table public.card_installments
      add constraint card_installments_transaction_fk foreign key (transaction_id) references public.transactions(id) on delete cascade;
  end if;
end $$;

create unique index if not exists card_installments_transaction_idx on public.card_installments(transaction_id) where transaction_id is not null and archived_at is null;
create index if not exists card_installments_account_idx on public.card_installments(account_id);

drop trigger if exists set_card_installments_updated_at on public.card_installments;
create trigger set_card_installments_updated_at before update on public.card_installments for each row execute function public.set_updated_at();
drop trigger if exists audit_card_installments on public.card_installments;
create trigger audit_card_installments after insert or update or delete on public.card_installments for each row execute function public.write_audit_log();

alter table public.card_installments enable row level security;
drop policy if exists "Own card installments" on public.card_installments;
create policy "Own card installments" on public.card_installments for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.card_installments from anon;

-- Interés de cada cuota de un diferido con intereses: lo registra la tarea diaria el día del corte.
alter table public.transactions add column if not exists installment_id uuid;
alter table public.transactions add column if not exists installment_no smallint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_installment_fk') then
    alter table public.transactions
      add constraint transactions_installment_fk foreign key (installment_id, user_id) references public.card_installments(id, user_id) on delete cascade;
  end if;
end $$;

create unique index if not exists transactions_installment_idx on public.transactions(installment_id, installment_no) where installment_id is not null;

-- Estados de cuenta: solo lo que anotas del banco; el resto se calcula. --------------
create table if not exists public.card_statements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid not null,
  cut_date date not null,
  min_payment numeric(14,2) check (min_payment is null or min_payment >= 0),
  bank_total numeric(14,2) check (bank_total is null or bank_total >= 0),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, cut_date),
  foreign key (account_id, user_id) references public.accounts(id, user_id)
);

drop trigger if exists set_card_statements_updated_at on public.card_statements;
create trigger set_card_statements_updated_at before update on public.card_statements for each row execute function public.set_updated_at();
alter table public.card_statements enable row level security;
drop policy if exists "Own card statements" on public.card_statements;
create policy "Own card statements" on public.card_statements for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.card_statements from anon;

-- Cálculos (iguales a cards.js) -----------------------------------------------------

-- Corte del mes de p_date desplazado p_months meses (día de corte 31 → último día en meses cortos).
create or replace function public.card_cut(p_date date, p_months int, p_day int)
returns date language sql immutable set search_path = '' as $$
  select make_date(
    extract(year from m)::int, extract(month from m)::int,
    least(p_day, extract(day from (m + interval '1 month - 1 day'))::int)
  )
  from (select (date_trunc('month', p_date) + make_interval(months => p_months))::date as m) s;
$$;

create or replace function public.card_cut_on_or_before(p_date date, p_day int)
returns date language sql immutable set search_path = '' as $$
  select case when public.card_cut(p_date, 0, p_day) <= p_date then public.card_cut(p_date, 0, p_day) else public.card_cut(p_date, -1, p_day) end;
$$;

create or replace function public.card_due_date(p_cut date, p_statement_day int, p_due_day int)
returns date language sql immutable set search_path = '' as $$
  select public.card_cut(p_cut, case when p_due_day > p_statement_day then 0 else 1 end, p_due_day);
$$;

-- Cuotas de un diferido (centavos → dólares al final). Sin intereses: cuotas iguales; con intereses: sistema francés.
create or replace function public.card_installment_rows(p_plan uuid)
returns table (n int, cut date, capital numeric, interest numeric)
language plpgsql stable set search_path = '' as $$
declare
  v_plan public.card_installments;
  v_acct public.accounts;
  v_rate numeric;
  v_balance numeric;
  v_payment numeric;
  v_interest numeric;
  v_capital numeric;
begin
  select * into v_plan from public.card_installments where id = p_plan;
  select * into v_acct from public.accounts where id = v_plan.account_id;
  if v_plan.with_interest and coalesce(v_acct.interest_rate, 0) > 0 then
    v_rate := case when v_acct.rate_type = 'efectiva'
      then power(1 + v_acct.interest_rate / 100, 1.0 / 12) - 1
      else v_acct.interest_rate / 100 / 12 end;
  end if;
  v_balance := v_plan.principal * 100;
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

-- Diferidos vigentes de una tarjeta, con la fecha desde la que cuentan.
create or replace function public.card_active_plans(p_account uuid)
returns table (id uuid, since date)
language sql stable set search_path = '' as $$
  select p.id, case when p.in_opening then a.opening_date else t.date end
  from public.card_installments p
  join public.accounts a on a.id = p.account_id
  left join public.transactions t on t.id = p.transaction_id
  where p.account_id = p_account and p.archived_at is null
    and (p.in_opening or (t.id is not null and t.deleted_at is null));
$$;

-- Lo que hay que pagar en el corte p_cut = deuda a esa fecha − capital de diferidos que todavía no se cobra.
create or replace function public.card_payable(p_account uuid, p_cut date)
returns numeric language sql stable set search_path = '' as $$
  select greatest(0,
    -(a.opening_balance + coalesce((
      select sum(t.amount) from public.transactions t
      where t.account_id = a.id and t.deleted_at is null and t.status = 'confirmado'
        and t.date >= a.opening_date and t.date <= p_cut), 0))
    - coalesce((
      select sum(r.capital)
      from public.card_active_plans(a.id) p
      cross join lateral public.card_installment_rows(p.id) r
      where p.since <= p_cut and r.cut > p_cut), 0))
  from public.accounts a where a.id = p_account;
$$;

create or replace function public.card_paid_since(p_account uuid, p_cut date)
returns numeric language sql stable set search_path = '' as $$
  select coalesce(sum(amount), 0) from public.transactions
  where account_id = p_account and deleted_at is null and status = 'confirmado'
    and kind = 'transferencia' and amount > 0 and date > p_cut;
$$;

-- Intereses de diferidos: un gasto en la tarjeta por cada cuota con interés cuyo corte ya llegó.
-- Solo desde que el diferido cuenta en la app (nunca antes del saldo inicial). Nunca se repite una cuota.
create or replace function public.generate_card_interest(p_user uuid default null, p_today date default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := coalesce(p_today, public.today_ec());
  v_plan record;
  v_row record;
  v_category uuid;
  v_count integer := 0;
  v_rows integer;
begin
  for v_plan in
    select p.*, s.since, a.opening_date, a.statement_day
    from public.card_installments p
    join public.accounts a on a.id = p.account_id
    cross join lateral (select since from public.card_active_plans(p.account_id) x where x.id = p.id) s
    where p.with_interest and coalesce(a.interest_rate, 0) > 0 and a.statement_day is not null
      and (p_user is null or p.user_id = p_user)
  loop
    for v_row in
      select * from public.card_installment_rows(v_plan.id) r
      where r.interest > 0 and r.cut <= v_today and r.cut >= greatest(v_plan.since, v_plan.opening_date)
    loop
      if v_category is null or not exists (select 1 from public.categories where id = v_category and user_id = v_plan.user_id) then
        insert into public.categories (user_id, name, kind, is_system)
        values (v_plan.user_id, 'Intereses y comisiones', 'gasto', true)
        on conflict (user_id, kind, name) do nothing;
        select id into v_category from public.categories where user_id = v_plan.user_id and kind = 'gasto' and name = 'Intereses y comisiones';
      end if;

      insert into public.transactions (user_id, account_id, date, amount, kind, category_id, status, description, note, installment_id, installment_no)
      values (v_plan.user_id, v_plan.account_id, v_row.cut, -v_row.interest, 'gasto', v_category, 'confirmado',
        format('Interés diferido: %s (%s/%s)', coalesce(nullif(v_plan.description, ''), 'compra'), v_row.n, v_plan.months),
        'Registrado automáticamente', v_plan.id, v_row.n)
      on conflict (installment_id, installment_no) where installment_id is not null do nothing;
      get diagnostics v_rows = row_count; v_count := v_count + v_rows;
    end loop;
  end loop;
  return v_count;
end;
$$;

-- Avisos de tarjetas (reemplaza la parte de tarjetas de build_alerts) ------------------
-- tarjeta-corte: estado de cuenta listo · tarjeta-pago: N días antes, si falta pagar · tarjeta-atrasado: pasó la fecha sin cubrir el mínimo.
create or replace function public.build_card_alerts(p_user uuid default null, p_today date default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := coalesce(p_today, public.today_ec());
  v_month text := to_char(v_today, 'YYYY-MM');
  v_count integer := 0;
  v_rows integer;
  r record;
  v_cut date;
  v_due date;
  v_total numeric;
  v_paid numeric;
  v_min numeric;
  v_estimated boolean;
begin
  for r in
    select a.*, -b.balance as debt, coalesce(s.notify_days_before, 2) as days_before, coalesce(s.card_usage_alert_pct, 30) as usage_pct
    from public.accounts a
    join public.account_balances b on b.account_id = a.id
    left join public.user_settings s on s.user_id = a.user_id
    where a.type = 'tarjeta_credito' and a.archived_at is null and (p_user is null or a.user_id = p_user)
  loop
    if r.statement_day is not null and r.due_day is not null then
      v_cut := public.card_cut_on_or_before(v_today, r.statement_day);
      if v_cut >= r.opening_date then
        v_due := public.card_due_date(v_cut, r.statement_day, r.due_day);
        v_total := public.card_payable(r.id, v_cut);
        v_paid := public.card_paid_since(r.id, v_cut);
        select min_payment into v_min from public.card_statements where account_id = r.id and cut_date = v_cut;
        v_estimated := v_min is null;
        v_min := least(v_total, coalesce(v_min, round(v_total * r.min_payment_pct / 100, 2)));

        if v_total > 0 and v_today <= v_due then
          insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
          values (r.user_id, 'tarjeta-corte', 'Estado de cuenta: ' || r.name,
            format('Corte del %s: debes pagar %s hasta el %s (mínimo %s%s).', to_char(v_cut, 'DD/MM'), public.fmt_usd(v_total),
              to_char(v_due, 'DD/MM'), public.fmt_usd(v_min), case when v_estimated then ', estimado' else '' end),
            '/cuentas/' || r.id, 'tarjeta-corte:' || r.id || ':' || v_cut)
          on conflict (user_id, dedupe_key) do nothing;
          get diagnostics v_rows = row_count; v_count := v_count + v_rows;
        end if;

        if v_total - v_paid > 0 and v_today <= v_due and v_due - v_today <= r.days_before then
          insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
          values (r.user_id, 'tarjeta-pago',
            case when v_due = v_today then 'Hoy vence el pago de ' else 'Pago por vencer: ' end || r.name,
            format('Te falta pagar %s de %s. Fecha máxima %s.', public.fmt_usd(v_total - v_paid), public.fmt_usd(v_total), to_char(v_due, 'DD/MM')),
            '/cuentas/' || r.id, 'tarjeta-pago:' || r.id || ':' || v_due)
          on conflict (user_id, dedupe_key) do nothing;
          get diagnostics v_rows = row_count; v_count := v_count + v_rows;
        end if;

        if v_today > v_due and v_paid < v_min then
          insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
          values (r.user_id, 'tarjeta-atrasado', 'Pago atrasado: ' || r.name,
            format('Venció el %s y pagaste %s; el mínimo era %s. Paga cuanto antes para evitar mora.', to_char(v_due, 'DD/MM'), public.fmt_usd(v_paid), public.fmt_usd(v_min)),
            '/cuentas/' || r.id, 'tarjeta-atrasado:' || r.id || ':' || v_due)
          on conflict (user_id, dedupe_key) do nothing;
          get diagnostics v_rows = row_count; v_count := v_count + v_rows;
        end if;
      end if;
    end if;

    if r.credit_limit is not null and r.credit_limit > 0 and r.debt / r.credit_limit * 100 >= r.usage_pct then
      insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
      values (r.user_id, 'tarjeta-uso', 'Uso alto del cupo: ' || r.name,
        format('Usas %s%% del cupo (%s de %s).', round(r.debt / r.credit_limit * 100), public.fmt_usd(r.debt), public.fmt_usd(r.credit_limit)),
        '/cuentas/' || r.id, 'tarjeta-uso:' || r.id || ':' || v_month)
      on conflict (user_id, dedupe_key) do nothing;
      get diagnostics v_rows = row_count; v_count := v_count + v_rows;
    end if;
  end loop;
  return v_count;
end;
$$;

-- build_alerts: igual que en la fase 2, pero las tarjetas van por build_card_alerts.
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

  -- 2) Tarjetas: estado de cuenta, pago por vencer, pago atrasado y uso alto del cupo.
  v_count := v_count + public.build_card_alerts(p_user, v_today);

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

-- La tarea diaria registra también los intereses de diferidos (antes de los avisos, para que el total ya los incluya).
create or replace function public.run_daily_jobs(p_user uuid default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_generated integer;
  v_interest integer;
  v_alerts integer;
  v_sent integer;
begin
  v_generated := public.generate_due_recurring(p_user);
  v_interest := public.generate_card_interest(p_user);
  v_alerts := public.build_alerts(p_user);
  v_sent := public.send_telegram_pending(p_user);
  return jsonb_build_object('registrados', v_generated + v_interest, 'avisos', v_alerts, 'telegram', v_sent);
end;
$$;

revoke execute on function public.generate_card_interest(uuid, date) from public, anon, authenticated;
revoke execute on function public.build_card_alerts(uuid, date) from public, anon, authenticated;
revoke execute on function public.build_alerts(uuid, date) from public, anon, authenticated;
revoke execute on function public.run_daily_jobs(uuid) from public, anon, authenticated;
