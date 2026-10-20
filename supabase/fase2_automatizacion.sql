-- Fase 2 · Automatización: frecuentes que se registran solos, avisos en la app y envío por Telegram.
-- Diseño: conocimiento/Movimientos recurrentes.md y conocimiento/Alertas.md
-- Requiere fase1_nucleo.sql y fase1b_frecuentes.sql. Idempotente.
--
-- Telegram: el token del bot NO va en este archivo. Se guarda una sola vez en el Vault de Supabase:
--   select vault.create_secret('<TOKEN_DEL_BOT>', 'telegram_bot_token');

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Frecuentes: monto fijo → se registra confirmado; variable → queda pendiente para confirmar el valor real.
alter table public.recurring_items add column if not exists fixed_amount boolean not null default true;

-- Ajustes por usuario --------------------------------------------------------

create table if not exists public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  telegram_chat_id text,
  telegram_enabled boolean not null default false,
  notify_days_before smallint not null default 2 check (notify_days_before between 0 and 15),
  card_usage_alert_pct numeric(5,2) not null default 30 check (card_usage_alert_pct between 1 and 100),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_user_settings_updated_at on public.user_settings;
create trigger set_user_settings_updated_at before update on public.user_settings for each row execute function public.set_updated_at();
alter table public.user_settings enable row level security;
drop policy if exists "Own settings" on public.user_settings;
create policy "Own settings" on public.user_settings for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.user_settings from anon;

-- Avisos -----------------------------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  link text not null default '/',
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  telegram_sent_at timestamptz,
  unique (user_id, dedupe_key)
);

create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
alter table public.notifications enable row level security;
-- El usuario lee sus avisos y los marca como leídos; los crea solo el servidor (funciones de abajo).
drop policy if exists "Read own notifications" on public.notifications;
create policy "Read own notifications" on public.notifications for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Mark own notifications" on public.notifications;
create policy "Mark own notifications" on public.notifications for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.notifications from anon;
revoke insert, delete on public.notifications from authenticated;

-- Utilidades ---------------------------------------------------------------------

create or replace function public.today_ec()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Guayaquil')::date;
$$;

create or replace function public.fmt_usd(p_amount numeric)
returns text language sql immutable set search_path = '' as $$
  select '$' || translate(to_char(abs(p_amount), 'FM999,999,990.00'), ',.', '.,');
$$;

-- Fechas de un frecuente entre p_from y p_to (misma regla que src/shared/lib/recurring.js).
create or replace function public.recurring_occurrences(
  p_frequency public.recurring_frequency, p_start date, p_end date, p_from date, p_to date
)
returns setof date
language plpgsql immutable set search_path = '' as $$
declare
  v_from date := greatest(p_start, p_from);
  v_to date := least(coalesce(p_end, p_to), p_to);
  v_day int := extract(day from p_start);
  v_days int[];
  v_month date;
  v_last int;
  v_d int;
  v_date date;
begin
  if v_from > v_to then return; end if;

  if p_frequency = 'semanal' then
    return query select g::date from generate_series(p_start, v_to, interval '7 days') g where g::date >= v_from;
    return;
  end if;

  v_days := case when p_frequency = 'quincenal'
    then array[v_day, case when v_day > 15 then v_day - 15 else v_day + 15 end]
    else array[v_day] end;

  v_month := date_trunc('month', v_from)::date;
  while v_month <= v_to loop
    if p_frequency <> 'anual' or extract(month from v_month) = extract(month from p_start) then
      v_last := extract(day from (v_month + interval '1 month - 1 day'));
      foreach v_d in array v_days loop
        v_date := make_date(extract(year from v_month)::int, extract(month from v_month)::int, least(v_d, v_last));
        if v_date between v_from and v_to then return next v_date; end if;
      end loop;
    end if;
    v_month := (v_month + interval '1 month')::date;
  end loop;
end;
$$;

-- Registro automático de frecuentes ----------------------------------------------
-- Solo desde que se creó el frecuente (no rellena fechas pasadas) y nunca dos veces la misma fecha,
-- aunque el movimiento se haya enviado a la papelera.

create or replace function public.generate_due_recurring(p_user uuid default null, p_today date default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := coalesce(p_today, public.today_ec());
  v_item record;
  v_date date;
  v_status public.tx_status;
  v_transfer uuid;
  v_count integer := 0;
begin
  for v_item in
    select * from public.recurring_items
    where archived_at is null and (p_user is null or user_id = p_user)
  loop
    for v_date in
      select d from public.recurring_occurrences(
        v_item.frequency, v_item.start_date, v_item.end_date,
        greatest(v_item.start_date, (v_item.created_at at time zone 'America/Guayaquil')::date), v_today
      ) d
    loop
      continue when exists (
        select 1 from public.transactions t where t.recurring_id = v_item.id and t.occurrence_date = v_date
      );
      v_status := case when v_item.fixed_amount then 'confirmado' else 'pendiente' end;

      if v_item.kind = 'transferencia' then
        v_transfer := gen_random_uuid();
        insert into public.transactions (user_id, account_id, date, amount, kind, transfer_id, status, description, note, recurring_id, occurrence_date)
        values
          (v_item.user_id, v_item.account_id, v_date, -v_item.amount, 'transferencia', v_transfer, v_status, v_item.name, 'Registrado automáticamente', v_item.id, v_date),
          (v_item.user_id, v_item.to_account_id, v_date, v_item.amount, 'transferencia', v_transfer, v_status, v_item.name, 'Registrado automáticamente', v_item.id, v_date);
      else
        insert into public.transactions (user_id, account_id, date, amount, kind, category_id, status, description, note, recurring_id, occurrence_date)
        values (v_item.user_id, v_item.account_id, v_date,
          case when v_item.kind = 'gasto' then -v_item.amount else v_item.amount end,
          v_item.kind, v_item.category_id, v_status, v_item.name, 'Registrado automáticamente', v_item.id, v_date);
      end if;

      insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
      values (
        v_item.user_id,
        'frecuente-registrado',
        case when v_status = 'pendiente' then 'Confirma el monto: ' || v_item.name else 'Registrado: ' || v_item.name end,
        case when v_status = 'pendiente'
          then format('Se anotó %s el %s como pendiente. Revisa el valor real y confírmalo.', public.fmt_usd(v_item.amount), to_char(v_date, 'DD/MM'))
          else format('%s el %s, registrado automáticamente.', public.fmt_usd(v_item.amount), to_char(v_date, 'DD/MM')) end,
        '/',
        'frecuente:' || v_item.id || ':' || v_date
      )
      on conflict (user_id, dedupe_key) do nothing;
      v_count := v_count + 1;
    end loop;
  end loop;
  return v_count;
end;
$$;

-- Reglas de avisos ----------------------------------------------------------------

create or replace function public.build_alerts(p_user uuid default null, p_today date default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := coalesce(p_today, public.today_ec());
  v_month text := to_char(v_today, 'YYYY-MM');
  v_count integer := 0;
  v_rows integer;
  r record;
  v_due date;
  v_last int;
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

  -- 2) Tarjetas: pago por vencer y uso alto del cupo.
  for r in
    select a.*, -b.balance as debt, coalesce(s.notify_days_before, 2) as days_before, coalesce(s.card_usage_alert_pct, 30) as usage_pct
    from public.accounts a
    join public.account_balances b on b.account_id = a.id
    left join public.user_settings s on s.user_id = a.user_id
    where a.type = 'tarjeta_credito' and a.archived_at is null and (p_user is null or a.user_id = p_user)
  loop
    if r.due_day is not null and r.debt > 0 then
      v_last := extract(day from (date_trunc('month', v_today) + interval '1 month - 1 day'));
      v_due := make_date(extract(year from v_today)::int, extract(month from v_today)::int, least(r.due_day, v_last));
      if v_due < v_today then
        v_due := (date_trunc('month', v_today) + interval '1 month')::date;
        v_last := extract(day from (v_due + interval '1 month - 1 day'));
        v_due := make_date(extract(year from v_due)::int, extract(month from v_due)::int, least(r.due_day, v_last));
      end if;
      if v_due - v_today <= r.days_before then
        insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
        values (r.user_id, 'tarjeta-pago',
          case when v_due = v_today then 'Hoy vence el pago de ' else 'Pago por vencer: ' end || r.name,
          format('Fecha máxima %s. Deuda actual %s.', to_char(v_due, 'DD/MM'), public.fmt_usd(r.debt)),
          '/cuentas/' || r.id, 'tarjeta-pago:' || r.id || ':' || v_due)
        on conflict (user_id, dedupe_key) do nothing;
        get diagnostics v_rows = row_count; v_count := v_count + v_rows;
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

-- Envío por Telegram -----------------------------------------------------------------

create or replace function public.send_telegram_pending(p_user uuid default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_token text;
  v_count integer := 0;
  r record;
begin
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'telegram_bot_token' limit 1;
  if v_token is null then return 0; end if;

  for r in
    select n.id, n.title, n.body, s.telegram_chat_id
    from public.notifications n
    join public.user_settings s on s.user_id = n.user_id
    where n.telegram_sent_at is null and s.telegram_enabled and s.telegram_chat_id is not null
      and n.created_at > now() - interval '2 days'
      and (p_user is null or n.user_id = p_user)
    order by n.created_at
    limit 50
  loop
    perform net.http_post(
      url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
      body := jsonb_build_object('chat_id', r.telegram_chat_id, 'text', '🔔 ' || r.title || E'\n' || r.body),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
    update public.notifications set telegram_sent_at = now() where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Tarea diaria y acciones desde la app -------------------------------------------------

create or replace function public.run_daily_jobs(p_user uuid default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_generated integer;
  v_alerts integer;
  v_sent integer;
begin
  v_generated := public.generate_due_recurring(p_user);
  v_alerts := public.build_alerts(p_user);
  v_sent := public.send_telegram_pending(p_user);
  return jsonb_build_object('registrados', v_generated, 'avisos', v_alerts, 'telegram', v_sent);
end;
$$;

-- "Revisar ahora" desde la app: solo para el usuario que llama.
create or replace function public.run_my_daily_jobs()
returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  return public.run_daily_jobs(auth.uid());
end;
$$;

-- Mensaje de prueba de Telegram para el usuario que llama.
create or replace function public.telegram_send_test()
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_settings public.user_settings;
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'telegram_bot_token') then return 'sin-token'; end if;
  select * into v_settings from public.user_settings where user_id = auth.uid();
  if v_settings.telegram_chat_id is null or not v_settings.telegram_enabled then return 'sin-chat'; end if;

  insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
  values (auth.uid(), 'prueba', 'Prueba de Control de gastos', 'Si lees esto, los avisos por Telegram funcionan.', '/', 'prueba:' || now());
  perform public.send_telegram_pending(auth.uid());
  return 'enviado';
end;
$$;

revoke execute on function public.generate_due_recurring(uuid, date) from public, anon, authenticated;
revoke execute on function public.build_alerts(uuid, date) from public, anon, authenticated;
revoke execute on function public.send_telegram_pending(uuid) from public, anon, authenticated;
revoke execute on function public.run_daily_jobs(uuid) from public, anon, authenticated;
revoke execute on function public.run_my_daily_jobs() from public, anon;
revoke execute on function public.telegram_send_test() from public, anon;
grant execute on function public.run_my_daily_jobs() to authenticated;
grant execute on function public.telegram_send_test() to authenticated;

-- Todos los días a las 11:00 UTC = 06:00 en Ecuador.
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'control-gastos-diario';
  perform cron.schedule('control-gastos-diario', '0 11 * * *', 'select public.run_daily_jobs()');
end $$;

select jobname, schedule, command from cron.job where jobname = 'control-gastos-diario';
