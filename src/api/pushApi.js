// Notificaciones push de este dispositivo. El envío lo hace la función del servidor "push"
// (supabase/functions/push); aquí solo se pide permiso y se guarda la suscripción del navegador.

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// En iPhone/iPad el push solo existe con la app agregada a la pantalla de inicio.
export function needsInstallForPush() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;
  return ios && !standalone;
}

function base64UrlToBytes(value) {
  const base64 = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

// En producción main.jsx ya lo registra; en desarrollo se registra aquí al activar.
async function registration() {
  return (await navigator.serviceWorker.getRegistration()) ?? navigator.serviceWorker.register('/sw.js');
}

async function invoke(supabase, action) {
  const { data, error } = await supabase.functions.invoke('push', { body: { action } });
  if (error) {
    const detail = await error.context?.json?.().catch(() => null);
    throw new Error(detail?.error ?? error.message);
  }
  return data;
}

// 'activo' | 'inactivo' | 'bloqueado' | 'no-disponible'
export async function pushState() {
  if (!pushSupported()) return 'no-disponible';
  if (Notification.permission === 'denied') return 'bloqueado';
  const current = await navigator.serviceWorker.getRegistration();
  const subscription = await current?.pushManager.getSubscription();
  return subscription && Notification.permission === 'granted' ? 'activo' : 'inactivo';
}

export async function enablePush(supabase) {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('No diste permiso para mostrar notificaciones.');
  const { publicKey } = await invoke(supabase, 'public-key');
  const current = await registration();
  await navigator.serviceWorker.ready;
  const subscription = (await current.pushManager.getSubscription())
    ?? await current.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) });
  const { endpoint, keys } = subscription.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    { endpoint, p256dh: keys.p256dh, auth: keys.auth, user_agent: navigator.userAgent.slice(0, 200) },
    { onConflict: 'endpoint' },
  );
  if (error) throw error;
}

export async function disablePush(supabase) {
  const current = await navigator.serviceWorker.getRegistration();
  const subscription = await current?.pushManager.getSubscription();
  if (!subscription) return;
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
  if (error) throw error;
  await subscription.unsubscribe();
}

export async function sendPushTest(supabase) {
  return invoke(supabase, 'test');
}
