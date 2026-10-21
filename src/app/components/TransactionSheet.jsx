import { useMemo, useState } from 'react';
import { canChargeInterest, cardReady, cutOnOrAfter, deferralFactor, installmentSchedule, monthlyRate } from '../../shared/lib/cards';
import { centsToInput, formatCents, parseAmountInput, sumCents } from '../../shared/lib/cents';
import { today } from '../../shared/lib/date';
import { isCard, isDebt } from '../../shared/lib/ledger';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { DateField } from '../ui/DateField';
import { Field } from '../ui/Field';
import { Sheet } from '../ui/Sheet';

const LAST_ACCOUNT_KEY = 'cg:last-account';
const MONTH_OPTIONS = [3, 6, 9, 12, 18, 24, 36, 48];

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
    ?? open.find((account) => !account.isSavings && !isDebt(account))
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

const shortDate = (date) => date.split('-').reverse().join('/');

// Compra con tarjeta: corriente (se cobra completa en el próximo corte) o diferida a meses.
function DeferredFields({ form, account, error, update }) {
  const rate = monthlyRate(account);
  const cents = parseAmountInput(form.amount);
  const months = Number(form.months);
  const factor = deferralFactor(account, months);
  const interestOk = canChargeInterest(account, months);
  const valid = Number.isFinite(cents) && cents > 0 && months >= 2 && months <= 60 && form.date;
  const rows = valid && form.payMode === 'diferido'
    ? installmentSchedule({ principalCents: cents, months, withInterest: form.withInterest && interestOk, firstCut: cutOnOrAfter(form.date, account.statementDay) }, account)
    : [];
  const interest = sumCents(rows, (row) => row.interest);

  return (
    <fieldset className="fieldset">
      <legend>Forma de pago</legend>
      <div className="segmented segmented-2" role="radiogroup" aria-label="Forma de pago">
        {[['corriente', 'Corriente'], ['diferido', 'Diferido a meses']].map(([value, label]) => (
          <button key={value} type="button" role="radio" aria-checked={form.payMode === value} className={`segment ${form.payMode === value ? 'is-active' : ''}`} onClick={() => update({ payMode: value })}>
            {label}
          </button>
        ))}
      </div>
      {form.payMode === 'corriente' ? (
        <p className="form-hint">Se cobra completo en el estado de cuenta del {shortDate(cutOnOrAfter(form.date || today(), account.statementDay))}.</p>
      ) : (
        <>
          <div className="chips" role="radiogroup" aria-label="Meses">
            {MONTH_OPTIONS.map((value) => (
              <button key={value} type="button" role="radio" aria-checked={months === value} className={`chip ${months === value ? 'is-active' : ''}`} onClick={() => update({ months: value })}>
                {value} meses
              </button>
            ))}
          </div>
          {error && <p className="field-error" role="alert">{error}</p>}
          <label className="check">
            <input type="checkbox" checked={form.withInterest} onChange={(event) => update({ withInterest: event.target.checked })} disabled={!interestOk} />
            <span>
              Con intereses
              {factor
                ? ` (factor del banco a ${months} meses: ${factor.toLocaleString('es-EC')} %)`
                : rate
                  ? ` (tasa de la tarjeta: ${account.interestRate.toLocaleString('es-EC')} % anual)`
                  : ' (agrega en Editar el factor del banco o la tasa de la tarjeta para usarlo)'}
            </span>
          </label>
          {rows.length > 0 && (
            <p className="alert alert-info">
              {months} cuotas de <strong>{formatCents(rows[0].payment)}</strong>: la primera en el corte del {shortDate(rows[0].cut)} y la última el {shortDate(rows.at(-1).cut)}.
              {interest > 0 ? ` En total pagarás ${formatCents(cents + interest)} (${formatCents(interest)} de intereses).` : ' Sin intereses.'}
              {' '}El cupo baja hoy por el total; en cada estado de cuenta solo se cobra la cuota.
            </p>
          )}
        </>
      )}
    </fieldset>
  );
}

// existing: movimiento a editar (en transferencias, la fila de salida con toAccountId).
// recurringItem: el frecuente del que viene el registro; permite aplicar el cambio "a este y los siguientes".
export function TransactionSheet({
  existing, confirm = false, recurringItem, accounts, categories, installments = [], defaults = {},
  onSave, onSaveFollowing, onReplace, onTrash, onTrashFollowing, onClose,
}) {
  const existingPlan = existing ? installments.find((plan) => plan.transactionId === existing.id && !plan.archivedAt) : null;
  const [form, setForm] = useState(() => {
    const values = {
      ...initialValues(existing, accounts, defaults),
      payMode: existingPlan ? 'diferido' : 'corriente',
      months: existingPlan?.months ?? 12,
      withInterest: existingPlan?.withInterest ?? false,
    };
    return confirm ? { ...values, status: 'confirmado' } : values;
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [showNote, setShowNote] = useState(Boolean(existing?.note));
  const [confirmTrash, setConfirmTrash] = useState(false);
  const [following, setFollowing] = useState(false);
  const isAdjustment = existing?.kind === 'ajuste';
  const changedShape = existing && (existing.kind === 'transferencia') !== (form.kind === 'transferencia');
  const canApplyFollowing = Boolean(existing && recurringItem && existing.occurrenceDate && !changedShape);

  const openAccounts = accounts.filter((account) => !account.archivedAt || account.id === form.accountId || account.id === form.toAccountId);
  const kindCategories = useMemo(
    () => categories.filter((category) => category.kind === form.kind && (!category.archivedAt || category.id === form.categoryId)),
    [categories, form.kind, form.categoryId],
  );
  const update = (patch) => setForm((current) => ({ ...current, ...patch }));
  const selectedAccount = accounts.find((account) => account.id === form.accountId);
  const cardPurchase = form.kind === 'gasto' && !isAdjustment && selectedAccount && isCard(selectedAccount);
  const deferred = cardPurchase && cardReady(selectedAccount) && form.payMode === 'diferido';

  function validate() {
    const next = {};
    const cents = parseAmountInput(form.amount);
    if (!Number.isFinite(cents) || cents <= 0) next.amount = 'Escribe un monto mayor que cero, por ejemplo 12,50.';
    if (!form.accountId) next.accountId = 'Elige una cuenta.';
    if (!form.date) next.date = 'Escribe una fecha válida, por ejemplo 20/10/2026.';
    if (deferred && !(Number(form.months) >= 2 && Number(form.months) <= 60)) next.months = 'Entre 2 y 60 meses.';
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
      // undefined: no aplica (no es compra con tarjeta y no tenía diferido); null: corriente.
      installment: deferred
        ? { months: Number(form.months), withInterest: form.withInterest && canChargeInterest(selectedAccount, Number(form.months)) }
        : (cardPurchase || existingPlan ? null : undefined),
    };

    setBusy(true);
    let saved;
    if (changedShape) saved = await onReplace(values, existing);
    else if (canApplyFollowing && following) saved = await onSaveFollowing(values, existing, recurringItem);
    else saved = await onSave(values, existing);
    setBusy(false);
    if (saved) {
      rememberAccount(form.accountId);
      onClose();
    }
  }

  const title = existing
    ? (confirm ? `Confirmar: ${existing.description || 'movimiento'}` : isAdjustment ? 'Ajuste de saldo' : 'Editar movimiento')
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

          {cardPurchase && (cardReady(selectedAccount) ? (
            <DeferredFields form={form} account={selectedAccount} error={errors.months} update={update} />
          ) : (
            <p className="form-hint">Para comprar a meses (diferido), agrega el día de corte y el de pago de la tarjeta en Cuentas → {selectedAccount.name} → Editar.</p>
          ))}

          {form.kind === 'transferencia' && (
            <p className="form-hint">Una transferencia mueve dinero entre tus cuentas: no cuenta como gasto ni como ingreso. Para pagar la tarjeta, transfiere desde tu banco hacia la tarjeta.</p>
          )}

          <div className="field-row">
            <Field label="Fecha" error={errors.date}>
              {(props) => <DateField {...props} value={form.date} onChange={(date) => update({ date })} />}
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
          {(() => {
            const account = accounts.find((item) => item.id === form.accountId);
            return account && form.date && form.date < account.openingDate ? (
              <p className="alert alert-info">
                Esta fecha es anterior al saldo inicial de {account.name} ({account.openingDate.split('-').reverse().join('/')}). Se guarda para tus reportes, pero no cambia el saldo de la cuenta, que ya lo incluye.
              </p>
            ) : null;
          })()}
          {canApplyFollowing && (
            <fieldset className="fieldset apply-scope">
              <legend>Aplicar el cambio a</legend>
              <div className="segmented" role="radiogroup" aria-label="Aplicar el cambio a">
                {[[false, 'Solo este'], [true, 'Este y los siguientes']].map(([value, label]) => (
                  <button key={label} type="button" role="radio" aria-checked={following === value} className={`segment ${following === value ? 'is-active' : ''}`} onClick={() => setFollowing(value)}>
                    {label}
                  </button>
                ))}
              </div>
              <p className="form-hint">
                {following
                  ? `También cambia el frecuente «${recurringItem.name}» (monto, cuenta y categoría) para las próximas fechas y los registros posteriores a este.`
                  : `Solo se corrige este registro; el frecuente «${recurringItem.name}» sigue igual.`}
              </p>
            </fieldset>
          )}
          {confirm && (
            <p className="form-hint">Pon el monto real que pagaste o recibiste y guarda: el movimiento pasa a confirmado y empieza a contar en tu saldo.</p>
          )}
          {defaults.recurringId && (
            <p className="form-hint">Viene de tus frecuentes. Si este mes el monto fue distinto, cámbialo: solo afecta a este registro.</p>
          )}
        </form>
      </Sheet>

      {confirmTrash && (recurringItem && existing.occurrenceDate ? (
        <ConfirmDialog
          title={`¿Eliminar este registro de «${recurringItem.name}»?`}
          message="Solo este: va a la papelera y el frecuente sigue. Este y los siguientes: también van a la papelera los registros posteriores y el frecuente deja de registrarse desde esta fecha. Podrás restaurar los movimientos desde Más → Papelera."
          confirmLabel="Este y los siguientes"
          altLabel="Solo este"
          danger
          onAlt={async () => {
            const done = await onTrash(existing);
            if (done) onClose();
            return done;
          }}
          onConfirm={async () => {
            const done = await onTrashFollowing(existing, recurringItem);
            if (done) onClose();
            return done;
          }}
          onClose={() => setConfirmTrash(false)}
        />
      ) : (
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
      ))}
    </>
  );
}
