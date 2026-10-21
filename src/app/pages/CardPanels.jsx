import { useMemo, useState } from 'react';
import {
  activePlans, cardStatus, cutOnOrBefore, partialPaymentInterest, planSummary, shiftCut, statementCuts, statementFor,
} from '../../shared/lib/cards';
import { centsToInput, formatCents, parseAmountInput, sumCents } from '../../shared/lib/cents';
import { today } from '../../shared/lib/date';
import { isCard } from '../../shared/lib/ledger';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { DateField } from '../ui/DateField';
import { Field } from '../ui/Field';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';

// Detalle de una tarjeta de crédito: qué pagar, estado de cuenta por corte y diferidos.
// Los cálculos están en shared/lib/cards.js.

const shortDate = (date) => date.split('-').reverse().join('/');
const longDate = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('es-EC', { day: 'numeric', month: 'long' });

export const cardTabs = [
  ['resumen', 'Resumen'],
  ['estado', 'Estado de cuenta'],
  ['diferidos', 'Diferidos'],
  ['movimientos', 'Movimientos'],
];

// Resumen ------------------------------------------------------------------------

export function CardSummary({ account, ledger, onPay, onNote }) {
  const day = today();
  const status = cardStatus(account, ledger, day);
  const upcoming = statementFor(account, ledger, status.nextCut);

  return (
    <>
      <section className={`card pay-card pay-${status.kind}`} aria-labelledby="pay-title">
        {status.kind === 'sin-estado' && (
          <>
            <h2 id="pay-title">Todavía sin estado de cuenta</h2>
            <p className="form-hint">
              Tu primer estado de cuenta en la app será el del <strong>{longDate(status.nextCut)}</strong> y lo pagarás hasta el {longDate(status.nextDue)}.
            </p>
          </>
        )}
        {status.kind === 'por-pagar' && (
          <>
            <p className="eyebrow">Estado de cuenta del {longDate(status.statement.cut)}</p>
            <h2 id="pay-title" className="pay-amount">Paga {formatCents(status.statement.remaining)}</h2>
            <p className="pay-due">
              hasta el <strong>{longDate(status.statement.due)}</strong>
              {status.daysLeft === 0 ? ' (hoy)' : ` (faltan ${status.daysLeft} día${status.daysLeft === 1 ? '' : 's'})`}
            </p>
            <StatementFigures statement={status.statement} />
          </>
        )}
        {status.kind === 'pagado' && (
          <>
            <p className="eyebrow">Estado de cuenta del {longDate(status.statement.cut)}</p>
            <h2 id="pay-title" className="pay-amount pay-ok"><Icon name="check" size={22} /> Pagado</h2>
            <p className="form-hint">Pagaste {formatCents(status.statement.paidSinceCut)} después del corte. No te queda nada por pagar de ese estado.</p>
          </>
        )}
        {status.kind === 'atrasado' && (
          <>
            <p className="eyebrow">Estado de cuenta del {longDate(status.statement.cut)}</p>
            <h2 id="pay-title" className="pay-amount">Te faltan {formatCents(status.statement.remaining)}</h2>
            <p className="alert alert-error" role="alert">
              Venció el {longDate(status.statement.due)}.
              {status.belowMinimum
                ? ` No alcanzaste el mínimo (${formatCents(status.statement.minimum)}): el banco puede cobrar mora e intereses. Paga cuanto antes.`
                : ' Cubriste el mínimo, pero el saldo que quedó genera intereses hasta que lo pagues.'}
            </p>
            <StatementFigures statement={status.statement} />
          </>
        )}

        <div className="hero-actions">
          <button type="button" className="btn btn-primary" onClick={() => onPay(status)}>Pagar tarjeta</button>
          {status.statement && (
            <button type="button" className="btn btn-secondary" onClick={() => onNote(status.statement)}>Anotar datos del banco</button>
          )}
        </div>
      </section>

      <section className="card" aria-labelledby="cycle-title">
        <div className="card-head"><h2 id="cycle-title">Ciclo en curso</h2></div>
        <p className="form-hint">
          Del {shortDate(nextDay(upcoming.prevCut))} al {shortDate(upcoming.cut)}.
          Si el corte fuera hoy, tu próximo estado de cuenta iría en <strong>{formatCents(upcoming.total)}</strong>
          {upcoming.installmentsDue.length > 0 && `, con ${upcoming.installmentsDue.length} cuota(s) de diferidos`}.
        </p>
      </section>
    </>
  );
}

function nextDay(date) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + 1);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function StatementFigures({ statement }) {
  return (
    <dl className="figures">
      <div><dt>Total del estado</dt><dd>{formatCents(statement.total)}</dd></div>
      <div><dt>Mínimo{statement.minimumEstimated ? ' (estimado)' : ''}</dt><dd>{formatCents(statement.minimum)}</dd></div>
      <div><dt>Ya pagaste</dt><dd>{formatCents(statement.paidSinceCut)}</dd></div>
    </dl>
  );
}

// Estado de cuenta ------------------------------------------------------------------

function Line({ label, cents, sign = '', items, strong = false }) {
  return (
    <div className={strong ? 'statement-total' : ''}>
      <dt>
        {items?.length ? (
          <details>
            <summary>{label} ({items.length})</summary>
            <ul>{items.map(([key, text, value]) => <li key={key}><span>{text}</span><span>{formatCents(value)}</span></li>)}</ul>
          </details>
        ) : label}
      </dt>
      <dd>{sign}{formatCents(cents)}</dd>
    </div>
  );
}

export function StatementView({ account, ledger, categories, onNote }) {
  const day = today();
  const cuts = useMemo(() => statementCuts(account, day), [account, day]);
  const lastClosed = cuts.filter((cut) => cut <= day).at(-1);
  const [cut, setCut] = useState(lastClosed ?? cuts.at(-1));
  const index = cuts.indexOf(cut);
  const statement = statementFor(account, ledger, cut);
  const open = cut > day;
  const categoryName = (id) => categories.find((category) => category.id === id)?.name ?? '';
  const txItems = (list, negate = true) => list.map((transaction) => [
    transaction.id,
    `${shortDate(transaction.date)} · ${transaction.description || categoryName(transaction.categoryId) || 'Movimiento'}`,
    negate ? -transaction.cents : transaction.cents,
  ]);
  const purchases = -sumCents(statement.purchases, (transaction) => transaction.cents);
  const installmentsCents = sumCents(statement.installmentsDue, ({ row }) => row.capital);
  const interests = -sumCents(statement.interests, (transaction) => transaction.cents);
  const others = -sumCents(statement.others, (transaction) => transaction.cents);
  const payments = sumCents(statement.payments, (transaction) => transaction.cents);
  const refunds = sumCents(statement.refunds, (transaction) => transaction.cents);
  const bankDiff = statement.bankTotalCents === null ? null : statement.bankTotalCents - statement.total;

  return (
    <section className="card" aria-labelledby="statement-title">
      <div className="card-head statement-head">
        <h2 id="statement-title">Corte del {longDate(cut)}</h2>
        <div className="month-nav">
          <button type="button" className="icon-button" onClick={() => setCut(cuts[index - 1])} disabled={index <= 0} aria-label="Corte anterior">
            <Icon name="chevronLeft" />
          </button>
          <button type="button" className="icon-button" onClick={() => setCut(cuts[index + 1])} disabled={index >= cuts.length - 1} aria-label="Corte siguiente">
            <Icon name="chevronRight" />
          </button>
        </div>
      </div>
      <p className="form-hint">
        Del {shortDate(nextDay(statement.prevCut))} al {shortDate(cut)} · pago hasta el {shortDate(statement.due)}
        {open && ' · en curso: aún puede cambiar'}
      </p>

      <dl className="statement-lines">
        <Line label={statement.firstInApp ? 'Deuda al empezar en la app (sin diferidos)' : 'Saldo anterior'} cents={statement.previous} />
        <Line label="Consumos corrientes" cents={purchases} sign="+ " items={txItems(statement.purchases)} />
        <Line
          label="Cuotas de diferidos"
          cents={installmentsCents}
          sign="+ "
          items={statement.installmentsDue.map(({ plan, row }) => [`${plan.id}:${row.n}`, `${plan.description || 'Diferido'} · cuota ${row.n}/${plan.months}`, row.capital])}
        />
        {interests > 0 && <Line label="Intereses de diferidos" cents={interests} sign="+ " items={txItems(statement.interests)} />}
        {others !== 0 && <Line label="Ajustes y otros cargos" cents={Math.abs(others)} sign={others > 0 ? '+ ' : '− '} items={txItems(statement.others)} />}
        {payments > 0 && <Line label="Pagos del ciclo" cents={payments} sign="− " items={txItems(statement.payments, false)} />}
        {refunds > 0 && <Line label="Devoluciones" cents={refunds} sign="− " items={txItems(statement.refunds, false)} />}
        <Line label={open ? 'Total hasta hoy' : 'Total a pagar'} cents={statement.total} strong />
      </dl>

      {statement.deferredPurchases.length > 0 && (
        <p className="form-hint">
          Compras diferidas en este ciclo: {statement.deferredPurchases.map((transaction) => `${transaction.description || 'compra'} (${formatCents(-transaction.cents)})`).join(', ')}. No se cobran completas: solo entra su cuota.
        </p>
      )}

      {!open && (
        <dl className="figures">
          <div><dt>Mínimo{statement.minimumEstimated ? ' (estimado)' : ''}</dt><dd>{formatCents(statement.minimum)}</dd></div>
          <div><dt>Pagado después del corte</dt><dd>{formatCents(statement.paidSinceCut)}</dd></div>
          <div><dt>Falta pagar</dt><dd>{formatCents(statement.remaining)}</dd></div>
        </dl>
      )}
      {bankDiff !== null && (
        <p className={`alert ${bankDiff === 0 ? 'alert-info' : 'alert-warning'}`}>
          Tu banco dice {formatCents(statement.bankTotalCents)}.
          {bankDiff === 0
            ? ' Cuadra con la app.'
            : ` Diferencia de ${formatCents(Math.abs(bankDiff))}: puede faltar registrar un consumo, un interés o un cargo del banco (regístralo, o ajusta el saldo de la tarjeta).`}
        </p>
      )}
      {!open && (
        <button type="button" className="btn btn-secondary" onClick={() => onNote(statement)}>Anotar mínimo y total del banco</button>
      )}
    </section>
  );
}

// Diferidos ---------------------------------------------------------------------------

export function InstallmentsView({ account, ledger, onOpenPurchase, onAddExisting, onEditExisting }) {
  const day = today();
  const plans = activePlans(ledger.installments, account, ledger.transactions);
  const summaries = plans.map((plan) => ({ plan, summary: planSummary(plan, account, day) }));
  const current = summaries.filter(({ summary }) => !summary.finished);
  const finished = summaries.filter(({ summary }) => summary.finished);

  const item = ({ plan, summary }) => (
    <li key={plan.id}>
      <button type="button" className="plan-row" onClick={() => (plan.inOpening ? onEditExisting(plan) : onOpenPurchase(plan.purchase))}>
        <span className="due-text">
          <strong>{plan.description || 'Diferido'}</strong>
          <small>
            {summary.billed}/{plan.months} cuotas cobradas · termina el {shortDate(summary.lastCut)}
            {plan.withInterest ? ` · ${formatCents(summary.totalInterest)} de intereses` : ' · sin intereses'}
            {plan.inOpening ? ' · ya lo tenías al empezar' : ''}
          </small>
        </span>
        <span className="plan-figures">
          <strong>{formatCents(summary.payment)}<small>/mes</small></strong>
          <small>falta {formatCents(summary.pendingCapital)}</small>
        </span>
      </button>
    </li>
  );

  return (
    <section className="card" aria-labelledby="plans-title">
      <div className="card-head">
        <h2 id="plans-title">Diferidos</h2>
        <button type="button" className="btn btn-secondary btn-small" onClick={onAddExisting}>Agregar uno que ya tenías</button>
      </div>
      {current.length ? (
        <>
          <ul className="plan-list">{current.map(item)}</ul>
          <p className="form-hint">
            Cada mes se cobran {formatCents(sumCents(current, ({ summary }) => summary.payment))} en cuotas.
            Pendiente por cobrar: {formatCents(sumCents(current, ({ summary }) => summary.pendingCapital))} (ya está en tu deuda).
          </p>
        </>
      ) : (
        <p className="empty">Sin diferidos. Al registrar un gasto con esta tarjeta puedes elegir "Diferido a meses".</p>
      )}
      {finished.length > 0 && (
        <details className="explain">
          <summary>Terminados ({finished.length})</summary>
          <ul className="plan-list">{finished.map(item)}</ul>
        </details>
      )}
    </section>
  );
}

// Formularios -------------------------------------------------------------------------

export function PayCardSheet({ account, accounts, ledger, status, onSave, onClose }) {
  const sources = accounts.filter((item) => !item.archivedAt && !isCard(item));
  const statement = status.statement;
  const debt = -(ledger.balances[account.id] ?? 0);
  const options = statement
    ? [['total', 'Lo que falta del estado', statement.remaining], ['minimo', 'Solo el mínimo', statement.minimumRemaining], ['deuda', 'Toda la deuda', debt]]
    : [['deuda', 'Toda la deuda', debt]];
  const firstOption = options.find(([, , cents]) => cents > 0) ?? options[0];
  const [choice, setChoice] = useState(firstOption[0]);
  const [amount, setAmount] = useState(centsToInput(firstOption[2]));
  const [fromAccountId, setFromAccountId] = useState(sources.find((item) => !item.isSavings)?.id ?? sources[0]?.id ?? '');
  const [date, setDate] = useState(today());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const cents = parseAmountInput(amount);
  const unpaid = statement && Number.isFinite(cents) ? statement.remaining - cents : 0;
  const cost = statement && unpaid > 0 ? partialPaymentInterest(account, unpaid, statement.due, status.nextCut) : null;

  function pick(key, value) {
    setChoice(key);
    if (value !== null) setAmount(centsToInput(value));
  }

  async function submit(event) {
    event.preventDefault();
    if (!Number.isFinite(cents) || cents <= 0) return setError('Escribe un monto mayor que cero.');
    if (!fromAccountId) return setError('Elige desde qué cuenta pagas.');
    if (!date) return setError('Escribe una fecha válida.');
    setBusy(true);
    const saved = await onSave({
      kind: 'transferencia', fromAccountId, toAccountId: account.id, cents, date,
      description: `Pago ${account.name}`, note: '', status: 'confirmado',
    });
    setBusy(false);
    if (saved) onClose();
  }

  return (
    <Sheet
      title={`Pagar ${account.name}`}
      onClose={onClose}
      footer={(
        <>
          <span className="spacer" />
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="pay-form" className="btn btn-primary" disabled={busy} aria-busy={busy}>{busy ? 'Guardando…' : 'Registrar pago'}</button>
        </>
      )}
    >
      <form id="pay-form" className="form-stack" onSubmit={submit} noValidate>
        <div className="choice-list" role="radiogroup" aria-label="Cuánto pagar">
          {options.map(([key, label, value]) => (
            <button key={key} type="button" role="radio" aria-checked={choice === key} className={`choice ${choice === key ? 'is-active' : ''}`} onClick={() => pick(key, value)}>
              <span>{label}</span><strong>{formatCents(value)}</strong>
            </button>
          ))}
          <button type="button" role="radio" aria-checked={choice === 'otro'} className={`choice ${choice === 'otro' ? 'is-active' : ''}`} onClick={() => pick('otro', null)}>
            <span>Otro monto</span>
          </button>
        </div>
        <Field label="Monto (USD)" error={error}>
          {(props) => <input {...props} className="input input-amount" inputMode="decimal" value={amount} onChange={(event) => { setChoice('otro'); setAmount(event.target.value); }} />}
        </Field>
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
        {unpaid > 0 && (
          <p className="alert alert-warning">
            Quedan {formatCents(unpaid)} sin pagar del estado de cuenta.
            {cost
              ? ` Generan unos ${formatCents(cost.cents)} de interés hasta el próximo corte (${cost.days} días a ${account.interestRate.toLocaleString('es-EC')} % anual).`
              : ' Generan intereses hasta que los pagues (agrega la tasa de la tarjeta en Editar para estimarlos).'}
          </p>
        )}
        <p className="form-hint">Se registra como transferencia desde tu cuenta hacia la tarjeta: baja la deuda y no cuenta como gasto.</p>
      </form>
    </Sheet>
  );
}

export function StatementNoteSheet({ account, statement, onSave, onClose }) {
  const [minimum, setMinimum] = useState(statement.minimumEstimated ? '' : centsToInput(statement.minimum));
  const [bankTotal, setBankTotal] = useState(statement.bankTotalCents === null ? '' : centsToInput(statement.bankTotalCents));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const parse = (text) => (text.trim() === '' ? null : parseAmountInput(text));
    const minPaymentCents = parse(minimum);
    const bankTotalCents = parse(bankTotal);
    const next = {};
    if (minPaymentCents !== null && !Number.isFinite(minPaymentCents)) next.minimum = 'Monto no válido.';
    if (bankTotalCents !== null && !Number.isFinite(bankTotalCents)) next.bankTotal = 'Monto no válido.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const saved = await onSave({ accountId: account.id, cutDate: statement.cut, minPaymentCents, bankTotalCents });
    setBusy(false);
    if (saved) onClose();
  }

  return (
    <Sheet
      title={`Estado del ${shortDate(statement.cut)}`}
      size="sm"
      onClose={onClose}
      footer={(
        <>
          <span className="spacer" />
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="statement-form" className="btn btn-primary" disabled={busy} aria-busy={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </>
      )}
    >
      <form id="statement-form" className="form-stack" onSubmit={submit} noValidate>
        <p className="form-hint">Copia los datos de tu estado de cuenta del banco. Si dejas el mínimo vacío, la app lo estima con el {account.minPaymentPct} %.</p>
        <Field label="Pago mínimo" error={errors.minimum}>
          {(props) => <input {...props} className="input" inputMode="decimal" placeholder={centsToInput(statement.minimum)} value={minimum} onChange={(event) => setMinimum(event.target.value)} />}
        </Field>
        <Field label="Total a pagar según el banco" error={errors.bankTotal} hint={`La app calcula ${formatCents(statement.total)}; si no cuadra te avisa.`}>
          {(props) => <input {...props} className="input" inputMode="decimal" value={bankTotal} onChange={(event) => setBankTotal(event.target.value)} />}
        </Field>
      </form>
    </Sheet>
  );
}

// Diferido que ya tenías al empezar a usar la app: su saldo está en la deuda inicial; aquí solo se dice cómo se cobra.
export function ExistingInstallmentSheet({ account, existing, onSave, onDelete, onClose }) {
  const day = today();
  const lastCut = cutOnOrBefore(day, account.statementDay);
  let billedBefore = 0;
  while (existing && billedBefore < existing.months - 1 && shiftCut(existing.firstCut, billedBefore, account.statementDay) <= lastCut) billedBefore += 1;
  const [form, setForm] = useState({
    description: existing?.description ?? '',
    amount: existing ? centsToInput(existing.principalCents) : '',
    months: String(existing?.months ?? 12),
    withInterest: existing?.withInterest ?? false,
    billed: String(billedBefore),
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const update = (patch) => setForm((current) => ({ ...current, ...patch }));

  async function submit(event) {
    event.preventDefault();
    const principalCents = parseAmountInput(form.amount);
    const months = Number(form.months);
    const billed = Number(form.billed);
    const next = {};
    if (!form.description.trim()) next.description = 'Ponle un nombre (ej. Celular, Muebles).';
    if (!Number.isFinite(principalCents) || principalCents <= 0) next.amount = 'Escribe el monto original de la compra.';
    if (!(Number.isInteger(months) && months >= 2 && months <= 60)) next.months = 'Entre 2 y 60.';
    if (!(Number.isInteger(billed) && billed >= 0 && billed < months)) next.billed = `Entre 0 y ${Math.max(0, months - 1)}.`;
    setErrors(next);
    if (Object.keys(next).length) return;
    // La cuota n.º "billed" fue la del último corte; si no te han cobrado ninguna, la primera es la del próximo corte.
    const firstCut = billed > 0 ? shiftCut(lastCut, -(billed - 1), account.statementDay) : shiftCut(lastCut, 1, account.statementDay);
    setBusy(true);
    const saved = await onSave({
      accountId: account.id, transactionId: null, description: form.description, principalCents, months,
      withInterest: form.withInterest && Boolean(account.interestRate), firstCut, inOpening: true,
    }, existing);
    setBusy(false);
    if (saved) onClose();
  }

  return (
    <>
      <Sheet
        title={existing ? 'Editar diferido' : 'Diferido que ya tenías'}
        onClose={onClose}
        footer={(
          <>
            {existing && <button type="button" className="btn btn-ghost-danger" onClick={() => setConfirmDelete(true)}>Eliminar</button>}
            <span className="spacer" />
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" form="installment-form" className="btn btn-primary" disabled={busy} aria-busy={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
          </>
        )}
      >
        <form id="installment-form" className="form-stack" onSubmit={submit} noValidate>
          <p className="form-hint">
            Lo que te falta pagar de este diferido ya está dentro de la deuda con la que empezaste. Aquí solo le dices a la app cómo se cobra,
            para que el estado de cuenta te pida la cuota y no todo de una vez.
          </p>
          <Field label="¿Qué compraste?" error={errors.description}>
            {(props) => <input {...props} className="input" placeholder="Ej. Celular" value={form.description} onChange={(event) => update({ description: event.target.value })} />}
          </Field>
          <div className="field-row">
            <Field label="Monto original (USD)" error={errors.amount}>
              {(props) => <input {...props} className="input" inputMode="decimal" value={form.amount} onChange={(event) => update({ amount: event.target.value })} />}
            </Field>
            <Field label="Meses" error={errors.months}>
              {(props) => <input {...props} className="input" inputMode="numeric" value={form.months} onChange={(event) => update({ months: event.target.value })} />}
            </Field>
          </div>
          <Field label="Cuotas que ya te cobraron" error={errors.billed} hint={`Contando la del corte del ${shortDate(lastCut)}, si ya salió en ese estado de cuenta.`}>
            {(props) => <input {...props} className="input" inputMode="numeric" value={form.billed} onChange={(event) => update({ billed: event.target.value })} />}
          </Field>
          <label className="check">
            <input type="checkbox" checked={form.withInterest} onChange={(event) => update({ withInterest: event.target.checked })} disabled={!account.interestRate} />
            <span>Con intereses{account.interestRate ? ` (tasa de la tarjeta: ${account.interestRate.toLocaleString('es-EC')} % anual)` : ' (agrega la tasa de la tarjeta para usarlo)'}</span>
          </label>
        </form>
      </Sheet>
      {confirmDelete && (
        <ConfirmDialog
          title="¿Eliminar este diferido?"
          message="La deuda de la tarjeta no cambia; solo deja de cobrarse por cuotas en el estado de cuenta."
          confirmLabel="Eliminar"
          danger
          onConfirm={async () => {
            const done = await onDelete(existing);
            if (done) onClose();
            return done;
          }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}
