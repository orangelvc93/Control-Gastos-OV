import { useState } from 'react';
import { parseAmountInput } from '../../shared/lib/cents';
import { today } from '../../shared/lib/date';
import { isDebt } from '../../shared/lib/ledger';
import { DateField } from '../ui/DateField';
import { Field } from '../ui/Field';
import { Sheet } from '../ui/Sheet';

const EXTERNAL = 'externo';

// Cuentas de ahorro e inversión: no se registran gastos, sino depósitos y retiros con su motivo.
// Retirar: transferencia a otra cuenta tuya (no es gasto; lo que hagas con ese dinero se anota en la cuenta destino).
// Depositar: transferencia desde otra cuenta tuya, o un ingreso externo (aporte del trabajo, regalo…) con su categoría.
export function SavingsMovementSheet({ account, accounts, categories, mode: initialMode = 'retiro', onSave, onClose }) {
  const others = accounts.filter((item) => !item.archivedAt && item.id !== account.id);
  const main = others.find((item) => !item.isSavings && !isDebt(item)) ?? others[0];
  const [mode, setMode] = useState(initialMode);
  const [amount, setAmount] = useState('');
  const [otherId, setOtherId] = useState(main?.id ?? '');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(today());
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const deposit = mode === 'deposito';
  const external = deposit && otherId === EXTERNAL;
  const incomeCategories = categories.filter((category) => category.kind === 'ingreso' && !category.archivedAt);
  // Retirar hacia una tarjeta o un crédito sería un pago: se permite, pero primero las cuentas del día a día.
  const destinations = [...others.filter((item) => !isDebt(item)), ...others.filter(isDebt)];

  async function submit(event) {
    event.preventDefault();
    const cents = parseAmountInput(amount);
    const next = {};
    if (!Number.isFinite(cents) || cents <= 0) next.amount = 'Escribe un monto mayor que cero, por ejemplo 150,00.';
    if (!otherId) next.otherId = deposit ? 'Elige de dónde viene.' : 'Elige a qué cuenta va.';
    if (external && !categoryId) next.categoryId = 'Elige una categoría.';
    if (!reason.trim()) next.reason = deposit ? 'Escribe el motivo, por ejemplo "Aporte mensual".' : 'Escribe el motivo, por ejemplo "Emergencia médica".';
    if (!date) next.date = 'Escribe una fecha válida.';
    setErrors(next);
    if (Object.keys(next).length) return;

    const base = { date, description: reason.trim(), note: '', status: 'confirmado' };
    const values = external
      ? { ...base, kind: 'ingreso', cents, accountId: account.id, categoryId }
      : deposit
        ? { ...base, kind: 'transferencia', cents, accountId: otherId, fromAccountId: otherId, toAccountId: account.id, categoryId: null }
        : { ...base, kind: 'transferencia', cents, accountId: account.id, fromAccountId: account.id, toAccountId: otherId, categoryId: null };
    setBusy(true);
    const saved = await onSave(values);
    setBusy(false);
    if (saved) onClose();
  }

  return (
    <Sheet
      title={deposit ? `Depositar en ${account.name}` : `Retirar de ${account.name}`}
      size="sm"
      onClose={onClose}
      footer={(
        <>
          <span className="spacer" />
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="savings-movement-form" className="btn btn-primary" disabled={busy} aria-busy={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </>
      )}
    >
      <form id="savings-movement-form" className="form-stack" onSubmit={submit} noValidate>
        <div className="segmented" role="radiogroup" aria-label="Tipo de movimiento">
          {[['deposito', 'Depósito'], ['retiro', 'Retiro']].map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              className={`segment segment-${value === 'deposito' ? 'ingreso' : 'gasto'} ${mode === value ? 'is-active' : ''}`}
              onClick={() => {
                setMode(value);
                if (value === 'retiro' && otherId === EXTERNAL) setOtherId(main?.id ?? '');
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <Field label="Monto (USD)" error={errors.amount} className="field-amount">
          {(props) => <input {...props} className="input input-amount" inputMode="decimal" autoComplete="off" placeholder="0,00" value={amount} onChange={(event) => setAmount(event.target.value)} data-autofocus />}
        </Field>

        <Field label="Motivo" error={errors.reason}>
          {(props) => (
            <input
              {...props}
              className="input"
              placeholder={deposit ? 'Ej. Aporte mensual, ahorro de la quincena' : 'Ej. Emergencia médica, viaje, cuota de la casa'}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          )}
        </Field>

        <div className="field-row">
          <Field label={deposit ? 'Viene de' : 'Va a la cuenta'} error={errors.otherId}>
            {(props) => (
              <select {...props} className="input" value={otherId} onChange={(event) => setOtherId(event.target.value)}>
                <option value="">Elige…</option>
                {deposit && <option value={EXTERNAL}>Ingreso externo (aporte del trabajo, regalo…)</option>}
                {destinations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            )}
          </Field>
          {external && (
            <Field label="Categoría" error={errors.categoryId}>
              {(props) => (
                <select {...props} className="input" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                  <option value="">Elige…</option>
                  {incomeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              )}
            </Field>
          )}
        </div>

        <Field label="Fecha" error={errors.date}>
          {(props) => <DateField {...props} value={date} onChange={setDate} />}
        </Field>

        <p className="form-hint">
          {deposit
            ? external
              ? 'Se registra como ingreso en esta cuenta. Para aportes que no son dinero disponible, usa una categoría con "Cuenta como ingreso disponible" desmarcado.'
              : 'Se registra como transferencia entre tus cuentas: no es ingreso ni gasto.'
            : 'Se registra como transferencia a esa cuenta: no cuenta como gasto. Si luego gastas ese dinero, anótalo como gasto en la cuenta a la que llegó.'}
        </p>
      </form>
    </Sheet>
  );
}
