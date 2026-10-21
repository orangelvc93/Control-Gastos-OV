import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { centsToInput, formatCents, parseAmountInput, sumCents } from '../../shared/lib/cents';
import { today } from '../../shared/lib/date';
import {
  comparePlans, debtList, debtRatio, HEALTHY_DEBT_PCT, HIGH_DEBT_PCT, monthlyIncome, newDebtImpact,
} from '../../shared/lib/debts';
import { Field } from '../ui/Field';
import { Icon } from '../ui/Icon';

// Plan para salir de deudas: todas las deudas, % de ingresos que se va en cuotas y avalancha vs. bola de nieve.
// Los cálculos están en shared/lib/debts.js. Las gráficas (recharts) se cargan solo al abrir esta pantalla.

// Mismos colores validados del dashboard (orden fijo): avalancha azul, bola de nieve naranja, solo mínimos violeta.
const COLORS = { avalancha: '#3987e5', bola: '#d95926', minimos: '#9085e9' };
const axis = { stroke: '#968ca8', fontSize: 12 };
const grid = 'rgba(255,255,255,0.08)';
const money = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const compact = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
const pctText = (value) => `${value.toLocaleString('es-EC', { maximumFractionDigits: 1 })} %`;
const levelText = { sano: 'Sano', cuidado: 'Con cuidado', alto: 'Alto' };

function monthsFromNow(months) {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  return date.toLocaleDateString('es-EC', { month: 'long', year: 'numeric' });
}

function duration(months) {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return [years ? `${years} año${years === 1 ? '' : 's'}` : '', rest ? `${rest} mes${rest === 1 ? '' : 'es'}` : ''].filter(Boolean).join(' y ') || 'este mes';
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <strong>{label === 0 ? 'Hoy' : `Mes ${label} · ${monthsFromNow(label)}`}</strong>
      {payload.map((entry) => (
        <span key={entry.dataKey}><i style={{ background: entry.color }} aria-hidden="true" />{entry.name}: {money.format(entry.value)}</span>
      ))}
    </div>
  );
}

function IncomeEditor({ income, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(income.cents ? centsToInput(income.cents) : '');
  const sourceText = {
    anotado: 'lo anotaste tú',
    promedio: `promedio de tus ingresos de los últimos ${income.months} mes(es)`,
    'este-mes': 'ingresos de este mes',
    'sin-datos': 'aún no hay ingresos registrados',
  }[income.source];

  if (!editing) {
    return (
      <span className="stat-hint">
        Ingreso mensual {formatCents(income.cents)} ({sourceText}) ·{' '}
        <button type="button" className="link" onClick={() => setEditing(true)}>cambiar</button>
      </span>
    );
  }

  return (
    <form
      className="inline-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const cents = value.trim() === '' ? null : parseAmountInput(value);
        if (cents !== null && !Number.isFinite(cents)) return;
        if (await onSave(cents)) setEditing(false);
      }}
    >
      <input className="input" inputMode="decimal" aria-label="Ingreso mensual" placeholder="Vacío = promedio" value={value} onChange={(event) => setValue(event.target.value)} />
      <button type="submit" className="btn btn-primary btn-small">Guardar</button>
    </form>
  );
}

export function DebtPlanPage({ ledger, navigate }) {
  const todayIso = today();
  const debts = useMemo(() => debtList(ledger), [ledger]);
  const income = monthlyIncome(ledger.transactions, ledger.settings, todayIso);
  const totalDebt = sumCents(debts, (debt) => debt.balance);
  const monthlyPayment = sumCents(debts, (debt) => debt.monthlyPayment);
  const ratio = debtRatio(monthlyPayment, income.cents);
  const [extra, setExtra] = useState('100');
  const extraCents = parseAmountInput(extra);
  const plans = useMemo(() => (debts.length ? comparePlans(debts, Number.isFinite(extraCents) ? extraCents : 0) : null), [debts, extraCents]);
  const [newDebt, setNewDebt] = useState({ amount: '', rate: '', months: '12' });
  const newImpact = (() => {
    const amountCents = parseAmountInput(newDebt.amount);
    const months = parseInt(newDebt.months, 10);
    const annualRate = newDebt.rate === '' ? 0 : Number(newDebt.rate.replace(',', '.'));
    if (!(amountCents > 0 && months > 0 && annualRate >= 0)) return null;
    return newDebtImpact({ amountCents, annualRate, months }, monthlyPayment, income.cents);
  })();
  const missingCardRate = debts.some((debt) => debt.kind === 'tarjeta' && !debt.annualRate);

  const chartData = plans
    ? Array.from({ length: Math.max(plans.avalancha.series.length, plans.bola.series.length, Math.min(plans.minimos.series.length, 121)) }, (_, month) => ({
      month,
      avalancha: (plans.avalancha.series[month]?.total ?? 0) / 100,
      bola: (plans.bola.series[month]?.total ?? 0) / 100,
      minimos: (plans.minimos.series[month]?.total ?? 0) / 100,
    }))
    : [];
  const best = plans && (plans.avalancha.totalInterest <= plans.bola.totalInterest ? 'avalancha' : 'bola');

  return (
    <div className="page">
      <div className="page-head"><h1>Plan para salir de deudas</h1></div>

      {!debts.length ? (
        <section className="card">
          <p className="empty">No tienes deudas abiertas. Si tienes una tarjeta o un crédito, créalos en Gestión para ver aquí tu plan.</p>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/gestion')}>Ir a Gestión</button>
        </section>
      ) : (
        <>
          <section className="stat-grid" aria-label="Indicadores de deuda">
            <div className="stat">
              <span className="stat-label">Deuda total</span>
              <strong className="stat-value">{formatCents(totalDebt)}</strong>
            </div>
            <div className="stat">
              <span className="stat-label">Pago mensual</span>
              <strong className="stat-value">{formatCents(monthlyPayment)}</strong>
              <span className="stat-hint">Cuotas de créditos + mínimo de tarjetas</span>
            </div>
            <div className={`stat debt-level debt-${ratio?.level ?? 'none'}`}>
              <span className="stat-label">De tus ingresos</span>
              <strong className="stat-value">{ratio ? pctText(ratio.pct) : '—'}</strong>
              <span className="stat-hint">
                {ratio ? `${levelText[ratio.level]}: lo sano es hasta ${HEALTHY_DEBT_PCT}–${HIGH_DEBT_PCT} %` : 'Anota tu ingreso mensual'}
              </span>
            </div>
          </section>
          <IncomeEditor key={income.cents} income={income} onSave={ledger.actions.saveMonthlyIncome} />
          {ratio?.level === 'alto' && (
            <p className="alert alert-error" role="alert">Más del {HIGH_DEBT_PCT} % de lo que ganas se va en deudas. Evita deudas nuevas y usa el plan de abajo para bajarlas.</p>
          )}

          <section className="card" aria-labelledby="debts-title">
            <div className="card-head"><h2 id="debts-title">Tus deudas</h2></div>
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th scope="col">Deuda</th><th scope="col">Saldo</th><th scope="col">Tasa anual</th><th scope="col">Pago al mes</th></tr></thead>
                <tbody>
                  {debts.map((debt) => (
                    <tr key={debt.id}>
                      <td><button type="button" className="link" onClick={() => navigate(`/cuentas/${debt.id}`)}>{debt.name}</button></td>
                      <td>{formatCents(debt.balance)}</td>
                      <td>{debt.annualRate ? pctText(debt.annualRate) : debt.kind === 'tarjeta' ? 'sin tasa' : '0 %'}</td>
                      <td>{formatCents(debt.monthlyPayment)}{debt.kind === 'tarjeta' ? ' (mín.)' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {missingCardRate && <p className="form-hint">Una tarjeta no tiene tasa: la simulación la trata sin intereses. Agrégala en la tarjeta → Editar.</p>}
            <p className="form-hint">Las tarjetas se simulan como saldo que paga el mínimo estimado cada mes (sin separar diferidos).</p>
          </section>

          <section className="card form-stack" aria-labelledby="plan-title">
            <h2 id="plan-title">¿Cuánto extra puedes poner cada mes?</h2>
            <Field label="Dinero extra al mes (USD)" hint="Además de los pagos mínimos. Cuando terminas una deuda, su pago pasa a la siguiente.">
              {(props) => <input {...props} className="input input-amount" inputMode="decimal" value={extra} onChange={(event) => setExtra(event.target.value)} />}
            </Field>

            {plans && (
              <>
                <div className="sim-grid">
                  {[
                    ['avalancha', 'Avalancha', 'Primero la deuda con la tasa más alta.'],
                    ['bola', 'Bola de nieve', 'Primero la deuda más pequeña.'],
                  ].map(([key, title, hint]) => {
                    const plan = plans[key];
                    return (
                      <article key={key} className={`sim-card ${best === key ? 'is-best' : ''}`}>
                        <h3><i className="legend-dot" style={{ background: COLORS[key] }} aria-hidden="true" />{title}{best === key && <small> · ahorra más</small>}</h3>
                        <p className="form-hint">{hint}</p>
                        <p>{plan.finished ? <>Libre de deudas en <strong>{duration(plan.months)}</strong> ({monthsFromNow(plan.months)}).</> : 'No termina con estos pagos: sube el monto extra.'}</p>
                        <p>Intereses: <strong>{formatCents(plan.totalInterest)}</strong></p>
                        {plans.minimos.finished && plan.finished && (
                          <p className="sim-saved">
                            {formatCents(plans.minimos.totalInterest - plan.totalInterest)} menos que pagar solo mínimos
                            {plans.minimos.months > plan.months ? ` y ${duration(plans.minimos.months - plan.months)} antes` : ''}
                          </p>
                        )}
                        <ol className="payoff-order">
                          {plan.payoffs.map((item) => <li key={item.id}>{item.name}{item.month ? ` · mes ${item.month}` : ''}</li>)}
                        </ol>
                      </article>
                    );
                  })}
                </div>
                <p className="form-hint">
                  Solo con los mínimos: {plans.minimos.finished ? `${duration(plans.minimos.months)} y ${formatCents(plans.minimos.totalInterest)} de intereses.` : 'no terminarías en 50 años.'}
                  {' '}La avalancha casi siempre paga menos intereses; la bola de nieve te da victorias rápidas que ayudan a seguir.
                </p>

                <div className="chart-legend" aria-hidden="true">
                  <span><i style={{ background: COLORS.avalancha }} />Avalancha</span>
                  <span><i style={{ background: COLORS.bola }} />Bola de nieve</span>
                  <span><i style={{ background: COLORS.minimos }} />Solo mínimos</span>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid vertical={false} stroke={grid} />
                    <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} minTickGap={24} tickFormatter={(value) => (value === 0 ? 'Hoy' : `${value} m`)} />
                    <YAxis tick={axis} tickFormatter={(value) => compact.format(value)} width={60} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ stroke: '#968ca8', strokeDasharray: '3 3' }} content={<ChartTooltip />} />
                    <Line type="monotone" dataKey="avalancha" name="Avalancha" stroke={COLORS.avalancha} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="bola" name="Bola de nieve" stroke={COLORS.bola} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="minimos" name="Solo mínimos" stroke={COLORS.minimos} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
                <details className="explain">
                  <summary>Ver como tabla</summary>
                  <table className="data-table">
                    <thead><tr><th scope="col">Plan</th><th scope="col">Tiempo</th><th scope="col">Intereses</th><th scope="col">Total pagado</th></tr></thead>
                    <tbody>
                      {[['Avalancha', plans.avalancha], ['Bola de nieve', plans.bola], ['Solo mínimos', plans.minimos]].map(([name, plan]) => (
                        <tr key={name}><td>{name}</td><td>{plan.finished ? duration(plan.months) : '—'}</td><td>{formatCents(plan.totalInterest)}</td><td>{formatCents(plan.totalPaid)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </>
            )}
          </section>
        </>
      )}

      <section className="card form-stack" aria-labelledby="new-debt-title">
        <h2 id="new-debt-title"><Icon name="card" size={18} /> Antes de endeudarte</h2>
        <p className="form-hint">Simula un crédito o un diferido nuevo y mira cómo cambia lo que pagas al mes.</p>
        <div className="field-row field-row-3">
          <Field label="Monto">
            {(props) => <input {...props} className="input" inputMode="decimal" placeholder="0,00" value={newDebt.amount} onChange={(event) => setNewDebt({ ...newDebt, amount: event.target.value })} />}
          </Field>
          <Field label="Tasa anual (%)">
            {(props) => <input {...props} className="input" inputMode="decimal" placeholder="0" value={newDebt.rate} onChange={(event) => setNewDebt({ ...newDebt, rate: event.target.value })} />}
          </Field>
          <Field label="Meses">
            {(props) => <input {...props} className="input" inputMode="numeric" value={newDebt.months} onChange={(event) => setNewDebt({ ...newDebt, months: event.target.value })} />}
          </Field>
        </div>
        {newImpact && (
          <p className={`alert ${newImpact.after?.level === 'alto' ? 'alert-error' : newImpact.after?.level === 'cuidado' ? 'alert-warning' : 'alert-info'}`}>
            Cuota de <strong>{formatCents(newImpact.payment)}</strong> al mes{newImpact.totalInterest > 0 ? ` (${formatCents(newImpact.totalInterest)} de intereses en total)` : ''}.
            {newImpact.after
              ? ` Tus deudas pasarían de ${pctText(newImpact.before.pct)} a ${pctText(newImpact.after.pct)} de tu ingreso: ${levelText[newImpact.after.level].toLowerCase()}.`
              : ' Anota tu ingreso mensual para ver cómo cambia tu endeudamiento.'}
          </p>
        )}
      </section>
    </div>
  );
}
