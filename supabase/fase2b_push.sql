-- Fase 2b · Notificaciones push del navegador (web app instalada).
-- Requiere fase2_automatizacion.sql. Idempotente.
-- El envío lo hace la función del servidor supabase/functions/push (cifrado Web Push + firma VAPID);
-- esta parte guarda las suscripciones de cada dispositivo y llama a la función en la tarea diaria.

-- Un registro por dispositivo/navegador donde se activaron las notificaciones.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "Own push subscriptions" on public.push_subscriptions;
create policy "Own push subscriptions" on public.push_subscriptions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.push_subscriptions from anon;

alter table public.notifications add column if not exists push_sent_at timestamptz;

-- Configuración privada del envío: claves VAPID (las genera la función la primera vez que corre)
-- y la clave con la que la tarea diaria se identifica ante la función. Sin políticas: solo el servidor la lee.
create table if not exists public.push_config (
  id boolean primary key default true check (id),
  vapid_keys jsonb,
  application_server_key text,
  cron_key text not null default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
);

alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;
insert into public.push_config default values on conflict do nothing;

-- Pide a la función que envíe los avisos sin leer de las últimas 24 h a los dispositivos suscritos.
create or replace function public.push_send_pending()
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_key text;
begin
  select cron_key into v_key from public.push_config;
  return net.http_post(
    url := 'https://fkvlqnbaltqlvrpuekjz.supabase.co/functions/v1/push',
    body := '{"action": "send-pending"}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', v_key)
  );
end;
$$;

revoke execute on function public.push_send_pending() from public, anon, authenticated;

-- La tarea diaria (06:00 Ecuador) ahora también envía los push.
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'control-gastos-diario';
  perform cron.schedule('control-gastos-diario', '0 11 * * *', 'select public.run_daily_jobs(); select public.push_send_pending();');
end $$;

select jobname, schedule, command from cron.job where jobname = 'control-gastos-diario';
