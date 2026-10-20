import { useMemo, useState } from 'react';
import { centsToInput, parseAmountInput } from '../../shared/lib/cents';
import { today } from '../../shared/lib/date';
import { isCard } from '../../shared/lib/ledger';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Field } from '../ui/Field';
import { Sheet } from '../ui/Sheet';

const LAST_ACCOUNT_KEY = 'cg:last-account';

const kinds = [
  ['gasto', 'Gasto'],
  ['ingreso', 'Ingreso'],
  ['transferencia', 'Transferencia'],
];

function readLastAccount() {
  try {
    return window.localStorage.getItem(LAST_ACCOUNT_KEY);
  } catch {
    return null;
  }
}

function rememberAccount(id) {
  try {
    window.localStorage.setItem(LAST_ACCOUNT_KEY, id);
  } catch {
    // Sin almacenamiento local (modo privado): solo se pierde la preferencia.
  }
}

function initialValues(existing, accounts, defaults) {
  const open = accounts.filter((account) => !account.archivedAt);
  const fallbackAccount = open.find((account) => account.id === (defaults.accountId ?? readLastAccount()))
    ?? open.find((account) => !account.isSavings && !isCard(account))
    ?? open[0];

  if (!existing) {
    // defaults puede venir de un frecuente: trae monto, cuentas, categoría, descripción y fecha.
    return {
      kind: defaults.kind ?? 'gasto',
      amount: defaults.cents ? centsToInput(defaults.cents) : '',
      accountId: defaults.accountId ?? fallbackAccount?.id ?? '',
      toAccountId: defaults.toAccountId ?? '',
      categoryId: defaults.categoryId ?? '',
      date: defaults.date ?? today(),
      description: defaults.description ?? '',
      note: defaults.note ?? '',
      status: 'confirmado',
    };
  }

  return {
    kind: existing.kind,
    amount: centsToInput(existing.cents),
    accountId: existing.accountId,
    toAccountId: existing.toAccountId ?? '',
    categoryId: existing.categoryId ?? '',
    date: existing.date,
    description: existing.description,
    note: existing.note,
    status: existing.status,
  };
}

// existing: movimiento a editar (en transferencias, la fila de salida con toAccountId).
export function TransactionSheet({ existing, accounts, categories, defaults = {}, onSave, onReplace, onTrash, onClose }) {
  const [form, setForm] = useState(() => initialValues(existing, accounts, defaults));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [showNote, setShowNote] = useState(Boolean(existing?.note));
  const [confirmTrash, setConfirmTrash] = useState(false);
  const isAdjustment = existing?.kind === 'ajuste';

  const openAccounts = accounts.filter((account) => !account.archivedAt || account.id === form.accountId || account.id === form.toAccountId);
  const kindCategories = useMemo(
    () => categories.filter((category) => category.kind === form.kind && (!category.archivedAt || category.id === form.categoryId)),
    [categories, form.kind, form.categoryId],
  );
  const update = (patch) => setForm((current) => ({ ...current, ...patch }));

  function validate() {
    const next = {};
    const cents = parseAmountInput(form.amount);
    if (!Number.isFinite(cents) || cents <= 0) next.amount = 'Escribe un monto mayor que cero, por ejemplo 12,50.';
    if (!form.accountId) next.accountId = 'Elige una cuenta.';
    if (!form.date) next.date = 'Elige una fecha.';
    if (form.kind === 'transferencia') {
      if (!form.toAccountId) next.toAccountId = 'Elige la cuenta de destino.';
      else if (form.toAccountId === form.accountId) next.toAccountId = 'El destino debe ser otra cuenta.';
    } else if (!isAdjustment && !form.categoryId) {
      next.categoryId = 'Elige una categoría.';
    }
    setErrors(next);
    return Object.keys(next).length ? null : cents;
  }

  async function submit(event) {
    event.preventDefault();
    const cents = validate();
    if (cents === null) return;

    const signed = isAdjustment
      ? Math.sign(existing.cents) * cents
      : form.kind === 'gasto' ? -cents : cents;
    const values = {
      kind: form.kind,
      cents: signed,
      accountId: form.accountId,
      fromAccountId: form.accountId,
      toAccountId: form.toAccountId,
      categoryId: form.kind === 'transferencia' || isAdjustment ? null : form.categoryId,
      date: form.date,
      description: form.description,
      note: form.note,
      status: form.status,
      recurringId: existing ? undefined : defaults.recurringId,
      occurrenceDate: existing ? undefined : defaults.occurrenceDate,
    };

    setBusy(true);
    const changedShape = existing && (existing.kind === 'transferencia') !== (form.kind === 'transferencia');
    const saved = changedShape ? await onReplace(values, existing) : await onSave(values, existing);
    setBusy(false);
    if (saved) {
      rememberAccount(form.accountId);
      onClose();
    }
  }

  const title = existing
    ? (isAdjustment ? 'Ajuste de saldo' : 'Editar movimiento')
    : defaults.recurringId ? `Registrar: ${defaults.description}` : 'Nuevo movimiento';

  return (
    <>
      <Sheet
        title={title}
        onClose={onClose}
        footer={(
          <>
            {existing && (
              <button type="button" className="btn btn-ghost-danger" onClick={() => setConfirmTrash(true)}>Eliminar</button>
            )}
            <span className="spacer" />
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" form="transaction-form" className="btn btn-primary" disabled={busy} aria-busy={busy}>
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        )}
      >
        <form id="transaction-form" className="form-stack" onSubmit={submit} noValidate>
          {!isAdjustment && (
            <div className="segmented" role="radiogroup" aria-label="Tipo de movimiento">
              {kinds.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={form.kind === value}
                  className={`segment segment-${value} ${form.kind === value ? 'is-active' : ''}`}
                  onClick={() => update({ kind: value, categoryId: '' })}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <Field label="Monto (USD)" error={errors.amount} className="field-amount">
            {(props) => (
              <input
                {...props}
                className="input input-amount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                value={form.amount}
                onChange={(event) => update({ amount: event.target.value })}
                autoFocus={!existing && !defaults.recurringId}
              />
            )}
          </Field>

          {form.kind === 'transferencia' ? (
            <div className="field-row">
              <Field label="Desde" error={errors.accountId}>
                {(props) => (
                  <select {...props} className="input" value={form.accountId} onChange={(event) => update({ accountId: event.target.value })}>
                    <option value="">Elige…</option>
                    {openAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                  </select>
                )}
              </Field>
              <Field label="Hacia" error={errors.toAccountId}>
                {(props) => (
                  <select {...props} className="input" value={form.toAccountId} onChange={(event) => update({ toAccountId: event.target.value })}>
                    <option value="">Elige…</option>
                    {openAccounts.filter((account) => account.id !== form.accountId).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                  </select>
                )}
              </Field>
            </div>
          ) : (
            <div className="field-row">
              <Field label={form.kind === 'ingreso' ? 'Entra a la cuenta' : 'Sale de la cuenta'} error={errors.accountId}>
                {(props) => (
                  <select {...props} className="input" value={form.accountId} onChange={(event) => update({ accountId: event.target.value })} disabled={isAdjustment}>
                    <option value="">Elige…</option>
                    {openAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                  </select>
                )}
              </Field>
              {!isAdjustment && (
                <Field label="Categoría" error={errors.categoryId}>
                  {(props) => (
                    <select {...props} className="input" value={form.categoryId} onChange={(event) => update({ categoryId: event.target.value })}>
                      <option value="">Elige…</option>
                      {kindCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                  )}
                </Field>
              )}
            </div>
          )}

          {form.kind === 'transferencia' && (
            <p className="form-hint">Una transferencia mueve dinero entre tus cuentas: no cuenta como gasto ni como ingreso. Para pagar la tarjeta, transfiere desde tu banco hacia la tarjeta.</p>
          )}

          <div className="field-row">
            <Field label="Fecha" error={errors.date}>
              {(props) => <input {...props} type="date" className="input" value={form.date} onChange={(event) => update({ date: event.target.value })} />}
            </Field>
            <Field label="Estado">
              {(props) => (
                <select {...props} className="input" value={form.status} onChange={(event) => update({ status: event.target.value })}>
                  <option value="confirmado">Confirmado</option>
                  <option value="pendiente">Pendiente (no afecta el saldo)</option>
                </select>
              )}
            </Field>
          </div>

          <Field label="Descripción">
            {(props) => (
              <input
                {...props}
                className="input"
                placeholder={form.kind === 'gasto' ? 'Ej. Supermaxi, almuerzo…' : 'Opcional'}
                value={form.description}
                onChange={(event) => update({ description: event.target.value })}
              />
            )}
          </Field>

          {showNote ? (
            <Field label="Nota">
              {(props) => <textarea {...props} className="input" rows={2} value={form.note} onChange={(event) => update({ note: event.target.value })} />}
            </Field>
          ) : (
            <button type="button" className="link" onClick={() => setShowNote(true)}>+ Agregar una nota</button>
          )}

          {isAdjustment && (
            <p className="form-hint">Un ajuste corrige el saldo para que cuadre con el banco. No cuenta como ingreso ni gasto.</p>
          )}
          {defaults.recurringId && (
            <p className="form-hint">Viene de tus frecuentes. Si este mes el monto fue distinto, cámbialo: solo afecta a este registro.</p>
          )}
        </form>
      </Sheet>

      {confirmTrash && (
        <ConfirmDialog
          title="¿Enviar a la papelera?"
          message="El movimiento deja de contar en tus saldos. Podrás restaurarlo desde Más → Papelera."
          confirmLabel="Enviar a la papelera"
          danger
          onConfirm={async () => {
            const done = await onTrash(existing);
            if (done) onClose();
            return done;
          }}
          onClose={() => setConfirmTrash(false)}
        />
      )}
    </>
  );
}
