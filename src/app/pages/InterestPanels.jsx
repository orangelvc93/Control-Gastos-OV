import { useState } from 'react';
import { centsToInput, formatCents, parseAmountInput } from '../../shared/lib/cents';
import { today } from '../../shared/lib/date';
import { monthKey, monthLabel, shiftMonth } from '../../shared/lib/ledger';
import {
  interestEstimate, interestHistory, interestMonthDate, interestTotals, suggestedInterestMonth,
} from '../../shared/lib/savings';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Field } from '../ui/Field';
import { Sheet } from '../ui/Sheet';

// Intereses de una cuenta: los anota el usuario cada mes; la app lleva el control y estima el mes en curso.

const pctText = (value) => (value === null ? '—' : `${value.toLocaleString('es-EC', { maximumFractionDigits: 2 })} %`);

export const interestTabs = [
  ['intereses', 'Intereses'],
  ['movimientos', 'Movimientos'],
];

export function InterestPanel({ account, ledger, onNote }) {
  const day = today();
  const history = interestHistory(account, ledger.transactions);
  const totals = interestTotals(history, day);
  const estimate = interestEstimate(account, ledger.transactions, ledger.balances[account.id] ?? 0, day);

  return (
    <>
      <section className="card pay-card" aria-labelledby="interest-estimate">
        <p className="eyebrow">Estimado de {estimate ? estimate.label.toLowerCase() : monthLabel(monthKey(day)).toLowerCase()}</p>
        <h2 id="interest-estimate" className="pay-amount">{estimate ? `≈ ${formatCents(estimate.cents)}` : '—'}</h2>
        <p className="form-hint">
          {!estimate && 'Anota el interés de uno o más meses (o la tasa de la cuenta en Editar) para estimar el siguiente.'}
          {estimate?.source === 'tasa' && `Con la tasa de ${account.interestRate.toLocaleString('es-EC')} % ${account.rateType === 'efectiva' ? 'efectiva' : 'nominal'} sobre el saldo de hoy.`}
          {estimate?.source === 'historial' && `Con el rendimiento promedio de tus últimos ${estimate.months} mes(es) anotados, sobre el saldo de hoy.`}
        </p>
        <dl className="figures">
          <div><dt>Último mes anotado</dt><dd>{totals.last ? `${formatCents(totals.last.cents)}` : '—'}</dd></div>
          <div><dt>Ganado este año</dt><dd>{formatCents(totals.year)}</dd></div>
          <div><dt>Ganado en total</dt><dd>{formatCents(totals.all)}</dd></div>
        </dl>
        <div className="hero-actions">
          <button type="button" className="btn btn-primary" onClick={() => onNote({})}>Anotar interés</button>
        </div>
      </section>

      <section className="card" aria-labelledby="interest-history">
        <div className="card-head"><h2 id="interest-history">Mes a mes</h2></div>
        {history.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th scope="col">Mes</th><th scope="col">Interés</th><th scope="col">Saldo promedio</th><th scope="col">Rend. anual aprox.</th></tr></thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id}>
                    <td><button type="button" className="link" onClick={() => onNote({ existing: row })}>{row.label}</button></td>
                    <td>{formatCents(row.cents)}</td>
                    <td>{formatCents(row.average)}</td>
                    <td>{pctText(row.annualPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">Aún no anotas intereses. Cada mes, cuando te paguen, pulsa "Anotar interés".</p>
        )}
        <p className="form-hint">El rendimiento es aproximado: interés del mes ÷ saldo promedio del mes, llevado a un año.</p>
      </section>
    </>
  );
}

// Anotar (o corregir) el interés de un mes. Se registra como ingreso "Rendimientos financieros" el último día del mes.
export function InterestSheet({ account, accounts, ledger, existing, onSave, onTrash, onClose }) {
  const day = today();
  const history = interestHistory(account, ledger.transactions);
  const noted = new Set(history.map((row) => row.key));
  const months = Array.from({ length: 13 }, (_, index) => shiftMonth(monthKey(day), -index)).reverse();
  const [key, setKey] = useState(existing?.key ?? suggestedInterestMonth(history, day));
  const [amount, setAmount] = useState(existing ? centsToInput(existing.cents) : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const destination = account.capitalizes || !account.interestAccountId ? account : accounts.find((item) => item.id === account.interestAccountId) ?? account;

  async function submit(event) {
    event.preventDefault();
    const cents = parseAmountInput(amount);
    if (!Number.isFinite(cents) || cents <= 0) return setError('Escribe lo que te pagaron, por ejemplo 12,35.');
    if (!existing && noted.has(key)) return setError(`Ya anotaste ${monthLabel(key).toLowerCase()}: tócalo en la lista para corregirlo.`);
    setBusy(true);
    const lastDay = interestMonthDate.last(key);
    const saved = await onSave({
      accountId: destination.id,
      cents,
      date: lastDay > day ? day : lastDay,
      description: `Interés ${monthLabel(key).toLowerCase()}: ${account.name}`,
      interestMonth: interestMonthDate.first(key),
      interestAccount: account.id,
    }, existing?.transaction);
    setBusy(false);
    if (saved) onClose();
  }

  return (
    <>
      <Sheet
        title={existing ? `Interés de ${existing.label.toLowerCase()}` : 'Anotar interés'}
        size="sm"
        onClose={onClose}
        footer={(
          <>
            {existing && <button type="button" className="btn btn-ghost-danger" onClick={() => setConfirmDelete(true)}>Eliminar</button>}
            <span className="spacer" />
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" form="interest-form" className="btn btn-primary" disabled={busy} aria-busy={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
          </>
        )}
      >
        <form id="interest-form" className="form-stack" onSubmit={submit} noValidate>
          <Field label="Mes">
            {(props) => (
              <select {...props} className="input" value={key} onChange={(event) => setKey(event.target.value)} disabled={Boolean(existing)}>
                {months.map((value) => <option key={value} value={value}>{monthLabel(value)}{noted.has(value) && value !== existing?.key ? ' (ya anotado)' : ''}</option>)}
              </select>
            )}
          </Field>
          <Field label="Interés que te pagaron (USD)" error={error} hint="Lo que llegó a la cuenta (neto).">
            {(props) => <input {...props} className="input input-amount" inputMode="decimal" placeholder="0,00" value={amount} onChange={(event) => setAmount(event.target.value)} data-autofocus />}
          </Field>
          <p className="form-hint">
            Se registra como ingreso "Rendimientos financieros" en {destination.name}
            {destination.id !== account.id ? ' (la cuenta a la que llega el interés)' : ''}. Si el mes es anterior a cuando empezaste a usar la app, no cambia el saldo (ya está incluido).
          </p>
        </form>
      </Sheet>
      {confirmDelete && (
        <ConfirmDialog
          title="¿Eliminar este interés?"
          message="Se envía a la papelera y deja de contar en tu control de intereses."
          confirmLabel="Eliminar"
          danger
          onConfirm={async () => {
            const done = await onTrash(existing.transaction);
            if (done) onClose();
            return done;
          }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}
