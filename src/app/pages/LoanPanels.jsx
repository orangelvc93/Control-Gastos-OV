import { useState } from 'react';
import { centsToInput, formatCents, parseAmountInput } from '../../shared/lib/cents';
import { addDays, today } from '../../shared/lib/date';
import { isDebt } from '../../shared/lib/ledger';
import {
  initialPaymentAmount, loanKindLabels, loanMonthlyRate, loanState, loanSystemLabels, projectSchedule, simulateExtra,
} from '../../shared/lib/loans';
import { shiftCut } from '../../shared/lib/cards';
import { DateField } from '../ui/DateField';
import { Field } from '../ui/Field';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';

// Créditos y préstamos: formulario, resumen, tabla de amortización y simulador de abonos.
// Los cálculos están en shared/lib/loans.js; las cuotas las registra el servidor cada día de pago.

const shortDate = (date) => (date ? date.split('-').reverse().join('/') : '—');
const monthYear = (date) => (date ? new Date(`${date}T12:00:00`).toLocaleDateString('es-EC', { month: 'long', year: 'numeric' }) : '—');
const parseNumber = (text) => Number(String(text ?? '').trim().replace(',', '.'));

export const loanTabs = [
  ['resumen', 'Resumen'],
  ['tabla', 'Tabla de pagos'],
  ['simulador', 'Abono extra'],
  ['movimientos', 'Movimientos'],
];

function nextMonth(date) {
  return shiftCut(date, 1, Number(date.split('-')[2]));
}

// Formulario ------------------------------------------------------------------------

function initialForm(existing, accounts) {
  const payable = accounts.filter((account) => !account.archivedAt && !isDebt(account));
  const main = payable.find((account) => !account.isSavings) ?? payable[0];
  if (existing) {
    const { loan, account } = existing;
    return {
      mode: loan.paidBefore > 0 || account.openingCents !== 0 ? 'existente' : 'nuevo',
      name: account.name, lender: account.institution, kind: loan.kind,
      principal: centsToInput(loan.principalCents), startDate: account.openingDate, toAccountId: '', debtNow: '', paidBefore: String(loan.paidBefore),
      annualRate: String(loan.annualRate).replace('.', ','), rateType: loan.rateType, termMonths: String(loan.termMonths), system: loan.system,
      firstPaymentDate: loan.firstPaymentDate, payment: centsToInput(loan.paymentAmountCents), monthlyFee: loan.monthlyFeeCents ? centsToInput(loan.monthlyFeeCents) : '',
      payAccountId: loan.payAccountId, autoConfirm: loan.autoConfirm,
    };
  }
  const start = today();
  return {
    mode: 'nuevo', name: '', lender: '', kind: 'bancario',
    principal: '', startDate: start, toAccountId: main?.id ?? '', debtNow: '', paidBefore: '0',
    annualRate: '', rateType: 'nominal', termMonths: '12', system: 'frances',
    firstPaymentDate: nextMonth(start), payment: '', monthlyFee: '', payAccountId: main?.id ?? '', autoConfirm: true,
  };
}

export function LoanSheet({ existing, accounts, onSave, onClose }) {
  const [form, setForm] = useState(() => initialForm(existing, accounts));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const update = (patch) => setForm((current) => ({ ...current, ...patch }));
  const payable = accounts.filter((account) => !account.archivedAt && !isDebt(account));
  const isNew = form.mode === 'nuevo';

  // Vista previa con lo escrito hasta ahora.
  const principalCents = parseAmountInput(form.principal);
  const debtCents = isNew ? principalCents : (existing ? -existing.account.openingCents : parseAmountInput(form.debtNow));
  const termMonths = parseInt(form.termMonths, 10);
  const paidBefore = isNew ? 0 : parseInt(form.paidBefore || '0', 10);
  const annualRate = form.annualRate === '' ? 0 : parseNumber(form.annualRate);
  const draft = {
    annualRate, rateType: form.rateType, termMonths, system: form.system, firstPaymentDate: form.firstPaymentDate,
    paymentDay: form.firstPaymentDate ? Number(form.firstPaymentDate.split('-')[2]) : 1, paidBefore,
    monthlyFeeCents: form.monthlyFee === '' ? 0 : parseAmountInput(form.monthlyFee),
  };
  const ready = Number.isFinite(debtCents) && debtCents > 0 && termMonths > paidBefore && annualRate >= 0 && form.firstPaymentDate && Number.isFinite(draft.monthlyFeeCents);
  const suggested = ready ? initialPaymentAmount({ system: form.system, rate: loanMonthlyRate(draft), balanceCents: debtCents, months: termMonths - paidBefore }) : null;
  const paymentCents = form.payment === '' ? suggested : parseAmountInput(form.payment);
  const rows = ready && Number.isFinite(paymentCents) && paymentCents > 0 ? projectSchedule({ ...draft, paymentAmountCents: paymentCents }, debtCents, 0, paymentCents) : [];
  const totalInterest = rows.reduce((total, row) => total + row.interest, 0);
  const totalPaid = rows.reduce((total, row) => total + row.payment, 0);

  async function submit(event) {
    event.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = 'Ponle un nombre (ej. Crédito del carro).';
    if (!Number.isFinite(principalCents) || principalCents <= 0) next.principal = isNew ? 'Escribe el monto del crédito.' : 'Escribe el monto original.';
    if (!existing && !isNew && !(Number.isFinite(debtCents) && debtCents > 0)) next.debtNow = 'Escribe cuánto debes hoy.';
    if (!(termMonths >= 1 && termMonths <= 480)) next.termMonths = 'Entre 1 y 480 meses.';
    if (!isNew && !(paidBefore >= 0 && paidBefore < termMonths)) next.paidBefore = `Entre 0 y ${Math.max(0, termMonths - 1)}.`;
    if (!(annualRate >= 0 && annualRate < 100)) next.annualRate = 'Tasa no válida (ej. 15,6).';
    if (!form.firstPaymentDate) next.firstPaymentDate = 'Escribe la fecha de la próxima cuota.';
    else if (isNew && !existing && form.startDate && form.firstPaymentDate <= form.startDate) next.firstPaymentDate = 'Debe ser después de la fecha en que lo recibiste.';
    if (isNew && !existing && !form.startDate) next.startDate = 'Escribe una fecha válida.';
    if (isNew && !existing && !form.toAccountId) next.toAccountId = 'Elige dónde entró el dinero.';
    if (!form.payAccountId) next.payAccountId = 'Elige desde qué cuenta pagas.';
    if (!(Number.isFinite(paymentCents) && paymentCents > 0)) next.payment = 'Cuota no válida.';
    if (!Number.isFinite(draft.monthlyFeeCents) || draft.monthlyFeeCents < 0) next.monthlyFee = 'Monto no válido.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    const saved = await onSave({
      account: {
        name: form.name, institution: form.lender, type: 'prestamo',
        openingCents: isNew ? 0 : -debtCents, openingDate: isNew ? form.startDate : today(),
        isSavings: false, creditLimitCents: null, statementDay: null, dueDay: null, interestRate: null, rateType: null, dayBasis: null,
        capitalizes: true, minPaymentPct: 10, deferralFactors: {}, color: 'red',
      },
      loan: {
        kind: form.kind, principalCents, annualRate, rateType: form.rateType, termMonths, system: form.system,
        firstPaymentDate: form.firstPaymentDate, paymentDay: draft.paymentDay, paidBefore,
        paymentAmountCents: paymentCents, monthlyFeeCents: draft.monthlyFeeCents, payAccountId: form.payAccountId, autoConfirm: form.autoConfirm,
      },
      disbursement: isNew && !existing ? { toAccountId: form.toAccountId } : null,
    }, existing);
    setBusy(false);
    if (saved) onClose();
  }

  return (
    <Sheet
      title={existing ? 'Editar crédito' : 'Nuevo crédito o préstamo'}
      onClose={onClose}
      footer={(
        <>
          <span className="spacer" />
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="loan-form" className="btn btn-primary" disabled={busy} aria-busy={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </>
      )}
    >
      <form id="loan-form" className="form-stack" onSubmit={submit} noValidate>
        {!existing && (
          <div className="segmented segmented-2" role="radiogroup" aria-label="¿Es nuevo?">
            {[['nuevo', 'Lo recibo ahora'], ['existente', 'Ya lo estoy pagando']].map(([value, label]) => (
              <button key={value} type="button" role="radio" aria-checked={form.mode === value} className={`segment ${form.mode === value ? 'is-active' : ''}`} onClick={() => update({ mode: value })}>
                {label}
              </button>
            ))}
          </div>
        )}
        <Field label="Nombre" error={errors.name}>
          {(props) => <input {...props} className="input" placeholder="Ej. Crédito del carro" value={form.name} onChange={(event) => update({ name: event.target.value })} />}
        </Field>
        <div className="field-row">
          <Field label="Tipo">
            {(props) => (
              <select {...props} className="input" value={form.kind} onChange={(event) => update({ kind: event.target.value })}>
                {Object.entries(loanKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            )}
          </Field>
          <Field label="Banco o persona">
            {(props) => <input {...props} className="input" placeholder="Ej. Banco Pichincha, mi hermano" value={form.lender} onChange={(event) => update({ lender: event.target.value })} />}
          </Field>
        </div>

        <div className="field-row">
          <Field label={isNew ? 'Monto del crédito' : 'Monto original'} error={errors.principal}>
            {(props) => <input {...props} className="input" inputMode="decimal" placeholder="0,00" value={form.principal} onChange={(event) => update({ principal: event.target.value })} />}
          </Field>
          {isNew && !existing && (
            <Field label="Lo recibiste el" error={errors.startDate}>
              {(props) => <DateField {...props} value={form.startDate} onChange={(startDate) => update({ startDate, firstPaymentDate: startDate ? nextMonth(startDate) : form.firstPaymentDate })} />}
            </Field>
          )}
          {!isNew && !existing && (
            <Field label="Debes hoy" error={errors.debtNow} hint="Saldo pendiente según el banco o la persona.">
              {(props) => <input {...props} className="input" inputMode="decimal" placeholder="0,00" value={form.debtNow} onChange={(event) => update({ debtNow: event.target.value })} />}
            </Field>
          )}
        </div>
        {isNew && !existing && (
          <Field label="El dinero entró a" error={errors.toAccountId} hint="Se registra como transferencia desde el crédito: no cuenta como ingreso.">
            {(props) => (
              <select {...props} className="input" value={form.toAccountId} onChange={(event) => update({ toAccountId: event.target.value })}>
                {payable.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            )}
          </Field>
        )}

        <div className="field-row field-row-3">
          <Field label="Tasa anual (%)" error={errors.annualRate} hint="0 si no tiene interés.">
            {(props) => <input {...props} className="input" inputMode="decimal" placeholder="0" value={form.annualRate} onChange={(event) => update({ annualRate: event.target.value })} />}
          </Field>
          <Field label="Tipo de tasa">
            {(props) => (
              <select {...props} className="input" value={form.rateType} onChange={(event) => update({ rateType: event.target.value })}>
                <option value="nominal">Nominal</option>
                <option value="efectiva">Efectiva anual</option>
              </select>
            )}
          </Field>
          <Field label="Plazo (meses)" error={errors.termMonths}>
            {(props) => <input {...props} className="input" inputMode="numeric" value={form.termMonths} onChange={(event) => update({ termMonths: event.target.value })} />}
          </Field>
        </div>
        <div className="field-row">
          <Field label="Sistema">
            {(props) => (
              <select {...props} className="input" value={form.system} onChange={(event) => update({ system: event.target.value })}>
                {Object.entries(loanSystemLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            )}
          </Field>
          {!isNew && (
            <Field label="Cuotas ya pagadas" error={errors.paidBefore}>
              {(props) => <input {...props} className="input" inputMode="numeric" value={form.paidBefore} onChange={(event) => update({ paidBefore: event.target.value })} />}
            </Field>
          )}
        </div>
        <div className="field-row">
          <Field label="Próxima cuota" error={errors.firstPaymentDate} hint="Las siguientes caen el mismo día de cada mes.">
            {(props) => <DateField {...props} value={form.firstPaymentDate} onChange={(firstPaymentDate) => update({ firstPaymentDate })} />}
          </Field>
          <Field label="Pagas desde" error={errors.payAccountId}>
            {(props) => (
              <select {...props} className="input" value={form.payAccountId} onChange={(event) => update({ payAccountId: event.target.value })}>
                {payable.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            )}
          </Field>
        </div>
        <div className="field-row">
          <Field
            label={form.system === 'aleman' ? 'Capital por cuota' : 'Cuota (sin seguros)'}
            error={errors.payment}
            hint={suggested ? `Calculada: ${formatCents(suggested)}. Cámbiala si tu banco cobra otra.` : 'Se calcula con el monto, la tasa y el plazo.'}
          >
            {(props) => <input {...props} className="input" inputMode="decimal" placeholder={suggested ? centsToInput(suggested) : '0,00'} value={form.payment} onChange={(event) => update({ payment: event.target.value })} />}
          </Field>
          <Field label="Seguros y cargos al mes" error={errors.monthlyFee}>
            {(props) => <input {...props} className="input" inputMode="decimal" placeholder="0,00" value={form.monthlyFee} onChange={(event) => update({ monthlyFee: event.target.value })} />}
          </Field>
        </div>
        <label className="check">
          <input type="checkbox" checked={form.autoConfirm} onChange={(event) => update({ autoConfirm: event.target.checked })} />
          <span>El banco me debita la cuota solo (se registra confirmada). Si lo desmarcas, queda en "Por confirmar".</span>
        </label>

        {rows.length > 0 && (
          <p className="alert alert-info">
            {rows.length} cuotas de unos <strong>{formatCents(rows[0].payment)}</strong>{form.system === 'aleman' ? ' (bajan cada mes)' : ''}, hasta {monthYear(rows.at(-1).date)}.
            {' '}Pagarás {formatCents(totalPaid)} en total: {formatCents(totalInterest)} de intereses
            {draft.monthlyFeeCents > 0 ? ` y ${formatCents(draft.monthlyFeeCents * rows.length)} de seguros y cargos` : ''}.
          </p>
        )}
      </form>
    </Sheet>
  );
}

// Resumen ----------------------------------------------------------------------------

export function LoanSummary({ loan, account, ledger, onExtra }) {
  const state = loanState(loan, account, ledger.transactions);
  const percent = Math.min(100, Math.round((state.paidCount / loan.termMonths) * 100));

  return (
    <section className="card pay-card" aria-labelledby="loan-next">
      {state.finished ? (
        <h2 id="loan-next" className="pay-amount pay-ok"><Icon name="check" size={22} /> Crédito pagado</h2>
      ) : (
        <>
          <p className="eyebrow">Próxima cuota {state.next ? `${state.next.number}/${loan.termMonths}` : ''}</p>
          <h2 id="loan-next" className="pay-amount">{state.next ? formatCents(state.next.payment) : '—'}</h2>
          <p className="pay-due">
            el <strong>{shortDate(state.next?.date)}</strong>
            {state.next && ` · interés ${formatCents(state.next.interest)} + capital ${formatCents(state.next.capital)}${state.next.fee ? ` + seguros ${formatCents(state.next.fee)}` : ''}`}
          </p>
        </>
      )}
      <span className="credit">
        <span className="credit-bar" aria-hidden="true"><span style={{ width: `${percent}%` }} /></span>
        <span className="credit-text">{state.paidCount} de {loan.termMonths} cuotas pagadas · termina en {monthYear(state.endDate)}</span>
      </span>
      <dl className="figures">
        <div><dt>Intereses pagados</dt><dd>{formatCents(state.interestPaid)}</dd></div>
        <div><dt>Intereses por pagar</dt><dd>{formatCents(state.interestLeft)}</dd></div>
        <div><dt>Te falta pagar</dt><dd>{formatCents(state.totalLeft)}</dd></div>
      </dl>
      <p className="form-hint">
        {loanKindLabels[loan.kind]} · {loan.annualRate ? `${loan.annualRate.toLocaleString('es-EC')} % ${loan.rateType === 'efectiva' ? 'efectiva' : 'nominal'} anual` : 'sin intereses'}
        {' '}· {loanSystemLabels[loan.system]} · {loan.autoConfirm ? 'se registra solo' : 'confirmas cada cuota'}
      </p>
      {!state.finished && (
        <div className="hero-actions">
          <button type="button" className="btn btn-secondary" onClick={onExtra}>Simular un abono extra</button>
        </div>
      )}
    </section>
  );
}

// Tabla de amortización --------------------------------------------------------------

export function LoanTable({ loan, account, ledger }) {
  const state = loanState(loan, account, ledger.transactions);
  const rows = [...state.paid.map((row) => ({ ...row, projected: false })), ...state.future];

  return (
    <section className="card" aria-labelledby="loan-table">
      <div className="card-head"><h2 id="loan-table">Tabla de pagos</h2></div>
      <p className="form-hint">Las cuotas pagadas salen de tus movimientos; las que vienen son una proyección con la deuda de hoy.</p>
      <div className="table-scroll">
        <table className="data-table loan-table">
          <thead>
            <tr>
              <th scope="col">N.º</th><th scope="col">Fecha</th><th scope="col">Cuota</th><th scope="col">Interés</th><th scope="col">Capital</th><th scope="col">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.number} className={row.projected ? '' : 'is-paid'}>
                <td>{row.number}{!row.projected && (row.pending ? ' · por confirmar' : ' ✓')}</td>
                <td>{shortDate(row.date)}</td>
                <td>{formatCents(row.payment)}</td>
                <td>{formatCents(row.interest)}</td>
                <td>{formatCents(row.capital)}</td>
                <td>{row.projected ? formatCents(row.balanceAfter) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Simulador de abono extra ---------------------------------------------------------------

export function LoanSimulator({ loan, account, ledger, onRegister }) {
  const state = loanState(loan, account, ledger.transactions);
  const [extra, setExtra] = useState('');
  const extraCents = parseAmountInput(extra);
  const result = Number.isFinite(extraCents) ? simulateExtra(loan, state, extraCents) : null;
  const tooMuch = Number.isFinite(extraCents) && extraCents > state.debt;

  if (state.finished) return <section className="card"><p className="empty">Este crédito ya está pagado.</p></section>;

  return (
    <section className="card form-stack" aria-labelledby="loan-sim">
      <h2 id="loan-sim">Abono extra a capital</h2>
      <p className="form-hint">Debes {formatCents(state.debt)}. Escribe cuánto podrías abonar y compara las dos opciones.</p>
      <Field label="Monto del abono (USD)" error={tooMuch ? `No puede ser mayor que lo que debes (${formatCents(state.debt)}).` : undefined}>
        {(props) => <input {...props} className="input input-amount" inputMode="decimal" placeholder="0,00" value={extra} onChange={(event) => setExtra(event.target.value)} />}
      </Field>
      {result && (
        <div className="sim-grid">
          <article className="sim-card">
            <h3>Reducir el plazo</h3>
            <p>Sigues pagando la misma cuota y terminas <strong>{result.plazo.monthsSaved} {result.plazo.monthsSaved === 1 ? 'mes' : 'meses'} antes</strong>, en {monthYear(result.plazo.endDate)}.</p>
            <p className="sim-saved">Ahorras {formatCents(result.plazo.saved)} de intereses</p>
            <button type="button" className="btn btn-primary" onClick={() => onRegister({ mode: 'plazo', cents: extraCents })}>Abonar reduciendo plazo</button>
          </article>
          <article className="sim-card">
            <h3>Reducir la cuota</h3>
            <p>Terminas en la misma fecha y tu cuota baja a <strong>{formatCents(result.cuota.newPayment)}</strong>{loan.system === 'aleman' ? ' de capital' : ''} (antes {formatCents(loan.paymentAmountCents)}).</p>
            <p className="sim-saved">Ahorras {formatCents(result.cuota.saved)} de intereses</p>
            <button type="button" className="btn btn-secondary" onClick={() => onRegister({ mode: 'cuota', cents: extraCents, newPaymentCents: result.cuota.newPayment })}>Abonar reduciendo cuota</button>
          </article>
        </div>
      )}
      <p className="form-hint">Reducir el plazo casi siempre ahorra más intereses; reducir la cuota libera dinero cada mes. Pregunta a tu banco si cobra por abonar.</p>
    </section>
  );
}

export function ExtraPaymentSheet({ loan, account, accounts, mode, cents, newPaymentCents, onSave, onClose }) {
  const sources = accounts.filter((item) => !item.archivedAt && !isDebt(item));
  const [fromAccountId, setFromAccountId] = useState(loan.payAccountId ?? sources[0]?.id ?? '');
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!fromAccountId || !date) return;
    setBusy(true);
    const saved = await onSave({ loan, account, fromAccountId, cents, date, newPaymentCents: mode === 'cuota' ? newPaymentCents : null });
    setBusy(false);
    if (saved) onClose();
  }

  return (
    <Sheet
      title="Registrar abono extra"
      size="sm"
      onClose={onClose}
      footer={(
        <>
          <span className="spacer" />
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="extra-form" className="btn btn-primary" disabled={busy} aria-busy={busy}>{busy ? 'Guardando…' : `Abonar ${formatCents(cents)}`}</button>
        </>
      )}
    >
      <form id="extra-form" className="form-stack" onSubmit={submit} noValidate>
        <p className="form-hint">
          {mode === 'plazo'
            ? 'La cuota sigue igual y el crédito termina antes.'
            : `Desde la próxima cuota pagarás ${formatCents(newPaymentCents)}${loan.system === 'aleman' ? ' de capital' : ''}.`}
          {' '}Se registra como transferencia hacia el crédito: baja la deuda y no cuenta como gasto.
        </p>
        <div className="field-row">
          <Field label="Desde la cuenta">
            {(props) => (
              <select {...props} className="input" value={fromAccountId} onChange={(event) => setFromAccountId(event.target.value)}>
                {sources.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            )}
          </Field>
          <Field label="Fecha">
            {(props) => <DateField {...props} value={date} onChange={setDate} />}
          </Field>
        </div>
        {date && date > addDays(today(), 0) && <p className="form-hint">Fecha futura: el abono contará desde ese día.</p>}
      </form>
    </Sheet>
  );
}
