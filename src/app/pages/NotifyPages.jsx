import { useEffect, useState } from 'react';
import { disablePush, enablePush, needsInstallForPush, pushState, sendPushTest } from '../../api/pushApi';
import { supabase } from '../../api/supabaseClient';
import { Field } from '../ui/Field';
import { Icon } from '../ui/Icon';
import { useNotify } from '../ui/Toast';
import { maskAmountsInText } from '../../shared/lib/cents';

function timeAgo(iso) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  return new Date(iso).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' });
}

// El tipo de aviso empieza por su módulo: frecuente-registrado, tarjeta-pago, mes-negativo…
const noticeGroups = [
  ['frecuente', 'Frecuentes'],
  ['tarjeta', 'Tarjetas'],
  ['mes', 'Mes'],
];

function groupOf(kind) {
  const prefix = String(kind).split('-')[0];
  return noticeGroups.some(([key]) => key === prefix) ? prefix : 'otros';
}

export function NotificationsPage({ ledger, navigate }) {
  const { notifications, actions } = ledger;
  const unreadIds = notifications.filter((item) => !item.readAt).map((item) => item.id);
  // Lo que se ve al abrir queda marcado como leído; se muestra resaltado mientras estés aquí.
  const [freshIds] = useState(() => new Set(unreadIds));
  const [group, setGroup] = useState('todos');
  const present = new Set(notifications.map((item) => groupOf(item.kind)));
  const groups = [['todos', 'Todos'], ...noticeGroups.filter(([key]) => present.has(key)), ...(present.has('otros') ? [['otros', 'Otros']] : [])];
  const visible = group === 'todos' ? notifications : notifications.filter((item) => groupOf(item.kind) === group);

  useEffect(() => {
    if (unreadIds.length) actions.markNotificationsRead(unreadIds);
    // Solo al entrar a la pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Avisos</h1>
        <button type="button" className="btn btn-secondary btn-small" onClick={actions.checkNow}>Revisar ahora</button>
      </div>
      {groups.length > 2 && (
        <div className="chips" role="group" aria-label="Filtrar avisos">
          {groups.map(([key, label]) => (
            <button key={key} type="button" className={`chip ${group === key ? 'is-active' : ''}`} aria-pressed={group === key} onClick={() => setGroup(key)}>
              {label}
            </button>
          ))}
        </div>
      )}
      <section className="card">
        {visible.length ? (
          <ul className="notice-list">
            {visible.map((item) => (
              <li key={item.id} className={freshIds.has(item.id) ? 'is-new' : ''}>
                <button type="button" className="notice" onClick={() => navigate(item.link || '/')}>
                  <span className="notice-dot" aria-hidden="true" />
                  <span className="notice-text">
                    <strong>{item.title}</strong>
                    <span>{maskAmountsInText(item.body)}</span>
                    <small>{timeAgo(item.createdAt)}{item.sentTelegram ? ' · enviado a Telegram' : ''}{freshIds.has(item.id) ? ' · nuevo' : ''}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">Sin avisos por ahora. Aquí verás pagos próximos, frecuentes registrados y alertas de tus tarjetas.</p>
        )}
      </section>
      <button type="button" className="link" onClick={() => navigate('/ajustes')}>Configurar avisos y Telegram</button>
    </div>
  );
}

const pushStateText = {
  activo: 'Activadas en este dispositivo.',
  inactivo: 'Desactivadas en este dispositivo.',
  bloqueado: 'Bloqueadas: el navegador no deja mostrar notificaciones. Actívalas en los ajustes del sitio (candado junto a la dirección) y vuelve aquí.',
  'no-disponible': 'Este navegador no admite notificaciones push.',
};

// Cada dispositivo se activa por separado (celular, computadora…).
function PushSection({ onTested }) {
  const notify = useNotify();
  const [state, setState] = useState('cargando');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    pushState().then(setState, () => setState('no-disponible'));
  }, []);

  async function attempt(task, success) {
    setBusy(true);
    try {
      const result = await task();
      if (success) notify(typeof success === 'function' ? success(result) : success);
    } catch (error) {
      notify(error.message || 'No se pudo completar.', 'error');
    }
    setState(await pushState().catch(() => 'no-disponible'));
    setBusy(false);
  }

  const install = needsInstallForPush();

  return (
    <>
      <h2>Notificaciones en este dispositivo</h2>
      {install ? (
        <p className="alert alert-info">
          En iPhone o iPad primero agrega la app a la pantalla de inicio (Compartir → Agregar a inicio) y ábrela desde ese icono; ahí aparecerá el botón para activarlas.
        </p>
      ) : (
        <>
          <p className="form-hint" role="status">{state === 'cargando' ? 'Revisando…' : pushStateText[state]}</p>
          <div className="hero-actions">
            {state === 'inactivo' && (
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => attempt(() => enablePush(supabase), 'Notificaciones activadas en este dispositivo')}>
                Activar notificaciones
              </button>
            )}
            {state === 'activo' && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() => attempt(async () => {
                    const result = await sendPushTest(supabase);
                    await onTested();
                    return result;
                  }, (result) => (result.sent ? 'Notificación de prueba enviada' : 'No llegó a ningún dispositivo; desactiva y vuelve a activar.'))}
                >
                  Enviar prueba
                </button>
                <button type="button" className="btn btn-ghost-danger" disabled={busy} onClick={() => attempt(() => disablePush(supabase), 'Notificaciones desactivadas en este dispositivo')}>
                  Desactivar
                </button>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}

export function SettingsPage({ ledger, navigate }) {
  const { settings, actions } = ledger;
  const [form, setForm] = useState(() => ({
    telegramChatId: settings?.telegramChatId ?? '',
    telegramEnabled: settings?.telegramEnabled ?? false,
    notifyDaysBefore: settings?.notifyDaysBefore ?? 2,
    cardUsageAlertPct: settings?.cardUsageAlertPct ?? 30,
  }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const update = (patch) => setForm((current) => ({ ...current, ...patch }));

  async function submit(event) {
    event.preventDefault();
    if (form.telegramChatId && !/^-?\d{5,15}$/.test(form.telegramChatId.trim())) {
      setError('El chat ID es un número (puede empezar con -). Ejemplo: 123456789.');
      return;
    }
    setError('');
    setBusy(true);
    await actions.saveSettings(form);
    setBusy(false);
  }

  return (
    <div className="page">
      <button type="button" className="back" onClick={() => navigate('/gestion')}><Icon name="chevronLeft" size={18} /> Gestión</button>
      <div className="page-head"><h1>Avisos y Telegram</h1></div>

      <form className="card form-stack" onSubmit={submit} noValidate>
        <h2>Cuándo avisarte</h2>
        <div className="field-row">
          <Field label="Días de anticipación" hint="Para frecuentes y pago de tarjetas.">
            {(props) => (
              <select {...props} className="input" value={form.notifyDaysBefore} onChange={(event) => update({ notifyDaysBefore: event.target.value })}>
                {[0, 1, 2, 3, 5, 7].map((days) => <option key={days} value={days}>{days === 0 ? 'El mismo día' : `${days} día(s) antes`}</option>)}
              </select>
            )}
          </Field>
          <Field label="Avisar si uso más del … % del cupo">
            {(props) => (
              <select {...props} className="input" value={form.cardUsageAlertPct} onChange={(event) => update({ cardUsageAlertPct: event.target.value })}>
                {[20, 30, 40, 50, 70, 90].map((pct) => <option key={pct} value={pct}>{pct} %</option>)}
              </select>
            )}
          </Field>
        </div>

        <PushSection onTested={ledger.reload} />

        <h2>Telegram</h2>
        <ol className="steps">
          <li>En Telegram, abre <strong>@BotFather</strong>, envía <code>/newbot</code> y sigue los pasos. Te dará un <strong>token</strong>.</li>
          <li>
            Guarda el token en Supabase (una sola vez), en <strong>SQL Editor</strong>:
            <pre>select vault.create_secret('TU_TOKEN', 'telegram_bot_token');</pre>
            Queda cifrado en el Vault. No lo pegues en la app ni lo compartas.
          </li>
          <li>Abre tu bot nuevo y envíale <code>/start</code> (así puede escribirte).</li>
          <li>Escribe a <strong>@userinfobot</strong>: te responde con tu <strong>Id</strong> (un número). Pégalo abajo.</li>
        </ol>
        <Field label="Tu chat ID de Telegram" error={error}>
          {(props) => <input {...props} className="input" inputMode="numeric" placeholder="123456789" value={form.telegramChatId} onChange={(event) => update({ telegramChatId: event.target.value })} />}
        </Field>
        <label className="check">
          <input type="checkbox" checked={form.telegramEnabled} onChange={(event) => update({ telegramEnabled: event.target.checked })} />
          <span>Enviar mis avisos a Telegram</span>
        </label>

        <div className="hero-actions">
          <button type="submit" className="btn btn-primary" disabled={busy} aria-busy={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
          <button type="button" className="btn btn-secondary" onClick={actions.sendTelegramTest}>Enviar prueba</button>
        </div>
        <p className="form-hint">Los avisos se revisan cada día a las 06:00 (Ecuador) y al abrir la app; a esa hora se envían también las notificaciones y Telegram. Siempre quedan en la campana.</p>
      </form>
    </div>
  );
}
