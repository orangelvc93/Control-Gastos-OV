import { useState } from 'react';
import { centsToInput, parseAmountInput } from '../../shared/lib/cents';
import { today } from '../../shared/lib/date';
import { isDebt } from '../../shared/lib/ledger';
import { frequencyLabels } from '../../shared/lib/recurring';
import { DateField } from '../ui/DateField';
import { Field } from '../ui/Field';
import { Sheet } from '../ui/Sheet';

const kinds = [
  ['gasto', 'Gasto fijo'],
  ['ingreso', 'Ingreso fijo'],
  ['transferencia', 'Ahorro / pago'],
];

function initialValues(existing, accounts) {
  if (existing) {
    return {
      name: existing.name,
      kind: existing.kind,
      amount: centsToInput(existing.cents),
      accountId: existing.accountId,
      toAccountId: existing.toAccountId ?? '',
      categoryId: existing.categoryId ?? '',
      frequency: existing.frequency,
      startDate: existing.startDate,
      endDate: existing.endDate ?? '',
      note: existing.note,
      fixedAmount: existing.fixedAmount,
    };
  }
  const main = accounts.find((account) => !account.archivedAt && !account.isSavings && !isDebt(account));
  return {
    name: '', kind: 'gasto', amount: '', accountId: main?.id ?? '', toAccountId: '', categoryId: '',
    frequency: 'mensual', startDate: today(), endDate: '', note: '', fixedAmount: true,
  };
}

export function RecurringSheet({ existing, accounts, categories, onSave, onClose }) {
  const [form, setForm] = useState(() => initialValues(existing, accounts));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const update = (patch) => setForm((current) => ({ ...current, ...patch }));
  const openAccounts = accounts.filter((account) => !account.archivedAt);
  const kindCategories = categories.filter((category) => category.kind === form.kind && !category.archivedAt);
  const transfer = form.kind === 'transferencia';

  async function submit(event) {
    event.preventDefault();
    const next = {};
    const cents = parseAmountInput(form.amount);
    if (!form.name.trim()) next.name = 'Ponle un nombre, por ejemplo "Arriendo".';
    if (!Number.isFinite(cents) || cents <= 0) next.amount = 'Escribe un monto mayor que cero.';
    if (!form.accountId) next.accountId = 'Elige una cuenta.';
    if (transfer && (!form.toAccountId || form.toAccountId === form.accountId)) next.toAccountId = 'Elige otra cuenta de destino.';
    if (!transfer && !form.categoryId) next.categoryId = 'Elige una categoría.';
    if (!form.startDate) next.startDate = 'Escribe una fecha válida (dd/mm/aaaa).';
    if (form.endDate && form.endDate < form.startDate) next.endDate = 'Debe ser después del inicio.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    const saved = await onSave({ ...form, cents }, existing);
    setBusy(false);
    if (saved) onClose();
  }

  return (
    <Sheet
      title={existing ? 'Editar frecuente' : 'Nuevo gasto o ingreso frecuente'}
      onClose={onClose}
      footer={(
        <>
          <span className="spacer" />
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="recurring-form" className="btn btn-primary" disabled={busy} aria-busy={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </>
      )}
    >
      <form id="recurring-form" className="form-stack" onSubmit={submit} noValidate>
        <div className="segmented" role="radiogroup" aria-label="Tipo">
          {kinds.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={form.kind === value}
              className={`segment segment-${value} ${form.kind === value ? 'is-active' : ''}`}
              onClick={() => update({ kind: value, categoryId: '', toAccountId: '' })}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="field-row">
          <Field label="Nombre" error={errors.name}>
            {(props) => <input {...props} className="input" placeholder={transfer ? 'Ej. Ahorro mensual a Metas' : 'Ej. Arriendo, Internet, Sueldo'} value={form.name} onChange={(event) => update({ name: event.target.value })} autoFocus={!existing} />}
          </Field>
          <Field label="Monto (USD)" error={errors.amount} hint="Si varía cada mes, pon el valor habitual.">
            {(props) => <input {...props} className="input" inputMode="decimal" placeholder="0,00" value={form.amount} onChange={(event) => update({ amount: event.target.value })} />}
          </Field>
        </div>

        <div className="field-row">
          <Field label={transfer ? 'Desde' : form.kind === 'ingreso' ? 'Entra a la cuenta' : 'Sale de la cuenta'} error={errors.accountId}>
            {(props) => (
              <select {...props} className="input" value={form.accountId} onChange={(event) => update({ accountId: event.target.value })}>
                <option value="">Elige…</option>
                {openAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            )}
          </Field>
          {transfer ? (
            <Field label="Hacia" error={errors.toAccountId}>
              {(props) => (
                <select {...props} className="input" value={form.toAccountId} onChange={(event) => update({ toAccountId: event.target.value })}>
                  <option value="">Elige…</option>
                  {openAccounts.filter((account) => account.id !== form.accountId).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
              )}
            </Field>
          ) : (
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

        <div className="field-row field-row-3">
          <Field label="Frecuencia">
            {(props) => (
              <select {...props} className="input" value={form.frequency} onChange={(event) => update({ frequency: event.target.value })}>
                {Object.entries(frequencyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            )}
          </Field>
          <Field label="Primera fecha" error={errors.startDate} hint="Define el día que se repite.">
            {(props) => <DateField {...props} value={form.startDate} onChange={(startDate) => update({ startDate })} shortcuts={false} />}
          </Field>
          <Field label="Hasta (opcional)" error={errors.endDate}>
            {(props) => <DateField {...props} value={form.endDate} onChange={(endDate) => update({ endDate })} shortcuts={false} />}
          </Field>
        </div>

        <label className="check">
          <input type="checkbox" checked={form.fixedAmount} onChange={(event) => update({ fixedAmount: event.target.checked })} />
          <span>
            Monto fijo: se registra solo y confirmado en su fecha. Desmárcalo si el valor cambia cada vez (luz, agua): se anotará como pendiente para que pongas el monto real.
          </span>
        </label>

        <Field label="Nota (opcional)">
          {(props) => <input {...props} className="input" value={form.note} onChange={(event) => update({ note: event.target.value })} />}
        </Field>

        {existing && <p className="form-hint">Los cambios aplican a las próximas fechas. Lo que ya registraste no cambia.</p>}
      </form>
    </Sheet>
  );
}
