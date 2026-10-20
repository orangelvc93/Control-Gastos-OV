// Función del servidor (Supabase Edge Function) que envía las notificaciones push.
// Se despliega con verify_jwt desactivado: cada acción comprueba quién llama.
//   public-key    (usuario con sesión) → clave pública para suscribir el dispositivo
//   test          (usuario con sesión) → crea un aviso de prueba y lo envía a sus dispositivos
//   send-pending  (tarea diaria, cabecera x-cron-key) → envía los avisos sin leer de las últimas 24 h
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as webpush from 'jsr:@negrel/webpush@0.5.0';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const APP_URL = 'https://control-gastos-ov.netlify.app';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

type Config = { vapid_keys: webpush.ExportedVapidKeys | null; application_server_key: string | null; cron_key: string };

// Las claves VAPID se generan la primera vez y quedan en push_config (solo el servidor la lee).
async function loadConfig(): Promise<Config> {
  const { data, error } = await supabase.from('push_config').select('*').single();
  if (error) throw error;
  if (data.vapid_keys) return data;

  const keys = await webpush.generateVapidKeys({ extractable: true });
  await supabase.from('push_config')
    .update({ vapid_keys: await webpush.exportVapidKeys(keys), application_server_key: await webpush.exportApplicationServerKey(keys) })
    .eq('id', true)
    .is('vapid_keys', null);
  return loadConfig();
}

async function appServer(config: Config) {
  const vapidKeys = await webpush.importVapidKeys(config.vapid_keys!);
  return webpush.ApplicationServer.new({ contactInformation: APP_URL, vapidKeys });
}

type Subscription = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };
type Payload = { title: string; body: string; link: string; tag: string };

// Devuelve true si llegó. Si el dispositivo ya no existe (desinstaló o revocó el permiso), se borra la suscripción.
async function sendTo(server: webpush.ApplicationServer, sub: Subscription, payload: Payload) {
  try {
    await server.subscribe({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } })
      .pushTextMessage(JSON.stringify(payload), { ttl: 86400 });
    return true;
  } catch (error) {
    if (error instanceof webpush.PushMessageError && [404, 410].includes(error.response.status)) {
      await supabase.from('push_subscriptions').delete().eq('id', sub.id);
    } else {
      console.error('push', sub.endpoint.slice(0, 40), error instanceof webpush.PushMessageError ? await error.response.text() : error);
    }
    return false;
  }
}

async function subscriptionsOf(userIds: string[]) {
  if (!userIds.length) return [];
  const { data, error } = await supabase.from('push_subscriptions').select('*').in('user_id', userIds);
  if (error) throw error;
  return data as Subscription[];
}

type Notice = { id: string; user_id: string; title: string; body: string; link: string };

// Hasta 3 avisos se envían uno por uno; más que eso, un solo resumen que abre la campana.
async function deliver(server: webpush.ApplicationServer, notices: Notice[]) {
  const subs = await subscriptionsOf([...new Set(notices.map((notice) => notice.user_id))]);
  let sent = 0;
  const delivered: string[] = [];
  for (const userId of new Set(subs.map((sub) => sub.user_id))) {
    const own = notices.filter((notice) => notice.user_id === userId);
    const payloads: Payload[] = own.length <= 3
      ? own.map((notice) => ({ title: notice.title, body: notice.body, link: notice.link, tag: notice.id }))
      : [{ title: `Tienes ${own.length} avisos nuevos`, body: own.slice(0, 3).map((notice) => notice.title).join(' · '), link: '/avisos', tag: 'resumen' }];
    for (const sub of subs.filter((item) => item.user_id === userId)) {
      for (const payload of payloads) if (await sendTo(server, sub, payload)) sent += 1;
    }
    delivered.push(...own.map((notice) => notice.id));
  }
  if (delivered.length) await supabase.from('notifications').update({ push_sent_at: new Date().toISOString() }).in('id', delivered);
  return sent;
}

async function userFrom(request: Request) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  // Verifica la firma y la vigencia del token con las claves públicas del proyecto (sin consultar la sesión).
  const { data, error } = await supabase.auth.getClaims(token);
  return error || !data?.claims?.sub ? null : { id: data.claims.sub as string };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  try {
    const { action } = await request.json().catch(() => ({}));
    const config = await loadConfig();

    if (action === 'send-pending') {
      if (request.headers.get('x-cron-key') !== config.cron_key) return json({ error: 'No autorizado' }, 401);
      const { data, error } = await supabase.from('notifications')
        .select('id, user_id, title, body, link')
        .is('push_sent_at', null)
        .is('read_at', null)
        .gt('created_at', new Date(Date.now() - 86400000).toISOString())
        .order('created_at')
        .limit(200);
      if (error) throw error;
      return json({ sent: await deliver(await appServer(config), data as Notice[]) });
    }

    const user = await userFrom(request);
    if (!user) return json({ error: 'Inicia sesión' }, 401);

    if (action === 'public-key') return json({ publicKey: config.application_server_key });

    if (action === 'test') {
      const { data, error } = await supabase.from('notifications').insert({
        user_id: user.id,
        kind: 'prueba',
        title: 'Prueba de Control de gastos',
        body: 'Si ves esto, las notificaciones de este dispositivo funcionan.',
        link: '/avisos',
        dedupe_key: `prueba-push:${Date.now()}`,
        // Ya se muestra como notificación: no hace falta repetirlo en Telegram.
        telegram_sent_at: new Date().toISOString(),
      }).select('id, user_id, title, body, link').single();
      if (error) throw error;
      const subs = await subscriptionsOf([user.id]);
      return json({ devices: subs.length, sent: await deliver(await appServer(config), [data as Notice]) });
    }

    return json({ error: 'Acción desconocida' }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
