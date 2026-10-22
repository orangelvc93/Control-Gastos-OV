import { useState } from 'react';
import { centsToInput, formatCents, parseAmountInput, sumCents } from '../../shared/lib/cents';
import { addDays, today } from '../../shared/lib/date';
import { monthlyIncome } from '../../shared/lib/debts';
import { isDebt, monthKey, monthLabel, shiftMonth } from '../../shared/lib/ledger';
import {
  categoryBudgets, emergencyFund, goalProgress, interestEstimate, interestHistory, interestTotals, monthPlan, suggestGroup,
} from '../../shared/lib/savings';
import { IncomeEditor } from '../components/IncomeEditor';
import { RecurringSheet } from '../components/RecurringSheet';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { DateField } from '../ui/DateField';
import { Field } from '../ui/Field';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';

// Fase 4 · Ahorro: presupuesto 50/30/20 con fondo de emergencia, metas y resumen de rendimientos.
// Cálculos en shared/lib/savings.js. Se cargan solo al abrir estas pantallas.

const shortDate = (date) => (date ? date.split('-').reverse().join('/') : '—');
const pctText = (value, digits = 0) => `${value.toLocaleString('es-EC', { maximumFractionDigits: digits })} %`;

function ProgressBar({ value, tone = 'normal' }) {
  return (
    <span className={`progress progress-${tone}`} aria-hidden="true">
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </span>
  );
}

// Presupuesto ------------------------------------------------------------------------------

function PlanEditor({ settings, onSave, onClose }) {
  const [values, setValues] = useState({ needs: String(settings.planNeedsPct), wants: String(settings.planWantsPct), savings: String(settings.planSavingsPct) });
  const numbers = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Number(String(value).replace(',', '.'))]));
  const sum = numbers.needs + numbers.wants + numbers.savings;
  const valid = Object.values(numbers).every((value) => value >= 0 && value <= 100) && Math.abs(sum - 100) < 0.01;

  return (
    <form
      className="form-stack"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!valid) return;
        const saved = await onSave({ ...settings, planNeedsPct: numbers.needs, planWantsPct: numbers.wants, planSavingsPct: numbers.savings });
        if (saved) onClose();
      }}
    >
      <div className="field-row field-row-3">
        {[['needs', 'Necesidades (%)'], ['wants', 'Gustos (%)'], ['savings', 'Ahorro y deudas (%)']].map(([key, label]) => (
          <Field key={key} label={label}>
            {(props) => <input {...props} className="input" inputMode="decimal" value={values[key]} onChange={(event) => setValues({ ...values, [key]: event.target.value })} />}
          </Field>
        ))}
      </div>
      {!valid && <p className="field-error" role="alert">Los tres deben sumar 100 % (ahora suman {pctText(sum || 0, 1)}).</p>}
      <div className="hero-actions">
        <button type="submit" className="btn btn-primary btn-small" disabled={!valid}>Guardar</button>
        <button type="button" className="btn btn-secondary btn-small" onClick={onClose}>Cancelar</button>
      </div>
    </form>
  );
}

function CategoryBudgetRow({ row, onSave }) {
  const [budget, setBudget] = useState(row.budget ? centsToInput(row.budget) : '');
  const tone = row.pct === null ? 'normal' : row.pct > 100 ? 'over' : row.pct >= 80 ? 'warn' : 'normal';

  function saveBudget() {
    const cents = budget.trim() === '' ? null : parseAmountInput(budget);
    if (cents !== null && !(Number.isFinite(cents) && cents > 0)) return;
    if (cents === row.budget) return;
    onSave(row.category, { budgetGroup: row.category.budgetGroup, monthlyBudgetCents: cents });
  }

  return (
    <li className="budget-row">
      <span className="budget-name">
        <strong>{row.category.name}</strong>
        <select
          className="input input-compact"
          aria-label={`Grupo de ${row.category.name}`}
          value={row.category.budgetGroup ?? ''}
          onChange={(event) => onSave(row.category, { budgetGroup: event.target.value || null, monthlyBudgetCents: row.budget })}
        >
          <option value="">Sin clasificar</option>
          <option value="necesidad">Necesidad</option>
          <option value="gusto">Gusto</option>
        </select>
      </span>
      <span className="budget-figures">
        <span>{formatCents(row.spent)}{row.budget ? ` de ${formatCents(row.budget)}` : ''}</span>
        {row.budget ? <ProgressBar value={row.pct} tone={tone} /> : null}
      </span>
      <input
        className="input input-compact budget-input"
        inputMode="decimal"
        placeholder="Presupuesto"
        aria-label={`Presupuesto mensual de ${row.category.name}`}
        value={budget}
        onChange={(event) => setBudget(event.target.value)}
        onBlur={saveBudget}
        onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
      />
    </li>
  );
}

export function BudgetPage({ ledger, navigate }) {
  const { settings, actions } = ledger;
  const day = today();
  const [month, setMonth] = useState(monthKey(day));
  const [editingPlan, setEditingPlan] = useState(false);
  const income = monthlyIncome(ledger.transactions, settings, day);
  const plan = monthPlan(ledger, month, settings, income.cents);
  const budgets = categoryBudgets(ledger, month);
  const unclassified = ledger.categories.filter((category) => category.kind === 'gasto' && !category.archivedAt && !category.budgetGroup);
  const fund = emergencyFund(ledger, settings);
  const fundAccounts = ledger.accounts.filter((account) => !account.archivedAt && !isDebt(account));
  const budgeted = budgets.filter((row) => row.budget);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Presupuesto</h1>
        <div className="month-nav">
          <button type="button" className="icon-button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mes anterior"><Icon name="chevronLeft" /></button>
          <strong aria-live="polite">{monthLabel(month)}</strong>
          <button type="button" className="icon-button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Mes siguiente"><Icon name="chevronRight" /></button>
        </div>
      </div>
      <IncomeEditor key={income.cents} income={income} onSave={actions.saveMonthlyIncome} />

      <section className="card form-stack" aria-labelledby="plan-title">
        <div className="card-head">
          <h2 id="plan-title">Plan {settings.planNeedsPct}/{settings.planWantsPct}/{settings.planSavingsPct}</h2>
          {!editingPlan && <button type="button" className="link" onClick={() => setEditingPlan(true)}>Cambiar porcentajes</button>}
        </div>
        {editingPlan && <PlanEditor settings={settings} onSave={actions.savePlanSettings} onClose={() => setEditingPlan(false)} />}
        {!income.cents && <p className="alert alert-info">Anota tu ingreso mensual (arriba) para calcular cuánto te toca en cada grupo.</p>}
        <ul className="plan-groups">
          {plan.groups.map((group) => {
            const ratio = group.planned ? (group.actual / group.planned) * 100 : 0;
            const tone = group.kind === 'goal' ? (ratio >= 100 ? 'good' : 'normal') : ratio > 100 ? 'over' : ratio >= 80 ? 'warn' : 'normal';
            return (
              <li key={group.key}>
                <div className="plan-group-head">
                  <strong>{group.label} <small>{pctText(group.pct)}</small></strong>
                  <span>{formatCents(group.actual)} de {formatCents(group.planned)}</span>
                </div>
                <ProgressBar value={ratio} tone={tone} />
                <small className="form-hint">
                  {group.kind === 'goal'
                    ? (group.actual >= group.planned ? 'Cumpliste tu meta de ahorro del mes.' : `Te faltan ${formatCents(group.planned - group.actual)} para tu meta de ahorro (transferencias a ahorros o abonos a deudas).`)
                    : group.actual > group.planned ? `Te pasaste por ${formatCents(group.actual - group.planned)}.` : `Te quedan ${formatCents(group.planned - group.actual)}.`}
                </small>
              </li>
            );
          })}
        </ul>
        {plan.unclassified > 0 && <p className="form-hint">{formatCents(plan.unclassified)} de gastos en categorías sin clasificar como necesidad o gusto.</p>}
        {unclassified.length > 0 && (
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => actions.saveCategoryBudgets(unclassified.map((category) => [category, { budgetGroup: suggestGroup(category), monthlyBudgetCents: category.monthlyBudgetCents }]))}
          >
            Clasificar automáticamente {unclassified.length} categoría(s)
          </button>
        )}
      </section>

      <section className="card" aria-labelledby="budgets-title">
        <div className="card-head"><h2 id="budgets-title">Por categoría</h2></div>
        <p className="form-hint">
          Escribe un presupuesto mensual para las categorías que quieras controlar: te aviso al llegar al 80 % y si lo superas.
          {budgeted.length > 0 && ` Presupuestado: ${formatCents(sumCents(budgeted, (row) => row.budget))} · gastado: ${formatCents(sumCents(budgeted, (row) => row.spent))}.`}
        </p>
        <ul className="budget-list">
          {budgets.map((row) => <CategoryBudgetRow key={`${row.category.id}:${row.budget}`} row={row} onSave={actions.saveCategoryBudget} />)}
        </ul>
      </section>

      <section className="card form-stack" aria-labelledby="fund-title">
        <h2 id="fund-title">Fondo de emergencia</h2>
        <Field label="Cuenta del fondo" hint="La cuenta donde guardas tu fondo de emergencia.">
          {(props) => (
            <select {...props} className="input" value={settings.emergencyAccountId ?? ''} onChange={(event) => actions.savePlanSettings({ ...settings, emergencyAccountId: event.target.value || null })}>
              <option value="">Elige…</option>
              {fundAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
          )}
        </Field>
        {fund.account && (
          fund.months === null ? (
            <p className="form-hint">Registra tus gastos fijos como frecuentes (Gestión) para calcular cuántos meses cubre tu fondo.</p>
          ) : (
            <>
              <p className={`pay-amount ${fund.months >= 3 ? 'pay-ok' : ''}`}>{fund.months.toLocaleString('es-EC', { maximumFractionDigits: 1 })} meses</p>
              <ProgressBar value={(fund.months / 6) * 100} tone={fund.months >= 3 ? 'good' : 'warn'} />
              <p className="form-hint">
                {formatCents(fund.balance)} ÷ {formatCents(fund.fixed.total)} de gastos fijos al mes
                ({formatCents(fund.fixed.recurringCents)} de frecuentes{fund.fixed.loanCents ? ` + ${formatCents(fund.fixed.loanCents)} de cuotas de créditos` : ''}).
                {' '}Lo recomendado es de 3 a 6 meses{fund.months < 3 ? `: te faltan ${formatCents(Math.max(0, fund.fixed.total * 3 - fund.balance))} para llegar a 3.` : '.'}
              </p>
            </>
          )
        )}
      </section>
      <button type="button" className="link" onClick={() => navigate('/metas')}>Ver mis metas de ahorro</button>
    </div>
  );
}

// Metas --------------------------------------------------------------------------------------

const statusText = {
  lograda: ['¡Lograda!', 'good'],
  'a-tiempo': ['Vas a tiempo', 'good'],
  'un-poco-atras': ['Un poco atrás', 'warn'],
  atrasada: ['Atrasada', 'over'],
  vencida: ['Pasó la fecha', 'over'],
};

function GoalSheet({ existing, accounts, onSave, onDelete, onClose }) {
  const savingsAccounts = accounts.filter((account) => !account.archivedAt && !isDebt(account));
  const [form, setForm] = useState({
    name: existing?.name ?? '',
    target: existing ? centsToInput(existing.targetCents) : '',
    deadline: existing?.deadline ?? '',
    accountId: existing?.accountId ?? '',
    manualSaved: existing?.manualSavedCents ? centsToInput(existing.manualSavedCents) : '',
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const update = (patch) => setForm((current) => ({ ...current, ...patch }));

  async function submit(event) {
    event.preventDefault();
    const targetCents = parseAmountInput(form.target);
    const manualSavedCents = form.manualSaved === '' ? 0 : parseAmountInput(form.manualSaved);
    const next = {};
    if (!form.name.trim()) next.name = 'Ponle un nombre (ej. Viaje, Carro).';
    if (!Number.isFinite(targetCents) || targetCents <= 0) next.target = 'Escribe cuánto quieres juntar.';
    if (form.deadline && form.deadline <= today()) next.deadline = 'Elige una fecha futura.';
    if (!form.accountId && !Number.isFinite(manualSavedCents)) next.manualSaved = 'Monto no válido.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const saved = await onSave({
      name: form.name, targetCents, deadline: form.deadline || null, accountId: form.accountId || null,
      manualSavedCents: form.accountId ? 0 : manualSavedCents, startDate: existing?.startDate ?? today(),
    }, existing);
    setBusy(false);
    if (saved) onClose();
  }

  return (
    <>
      <Sheet
        title={existing ? 'Editar meta' : 'Nueva meta'}
        onClose={onClose}
        footer={(
          <>
            {existing && <button type="button" className="btn btn-ghost-danger" onClick={() => setConfirmDelete(true)}>Archivar</button>}
            <span className="spacer" />
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" form="goal-form" className="btn btn-primary" disabled={busy} aria-busy={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
          </>
        )}
      >
        <form id="goal-form" className="form-stack" onSubmit={submit} noValidate>
          <Field label="Nombre" error={errors.name}>
            {(props) => <input {...props} className="input" placeholder="Ej. Viaje a Galápagos" value={form.name} onChange={(event) => update({ name: event.target.value })} />}
          </Field>
          <div className="field-row">
            <Field label="Monto objetivo" error={errors.target}>
              {(props) => <input {...props} className="input" inputMode="decimal" placeholder="0,00" value={form.target} onChange={(event) => update({ target: event.target.value })} />}
            </Field>
            <Field label="Fecha límite" error={errors.deadline} hint="Opcional.">
              {(props) => <DateField {...props} value={form.deadline} onChange={(deadline) => update({ deadline })} shortcuts={false} />}
            </Field>
          </div>
          <Field label="Cuenta donde ahorras para esta meta" hint="Lo ahorrado será el saldo de esa cuenta. Sin cuenta, lo anotas tú.">
            {(props) => (
              <select {...props} className="input" value={form.accountId} onChange={(event) => update({ accountId: event.target.value })}>
                <option value="">Sin cuenta (lo anoto yo)</option>
                {savingsAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            )}
          </Field>
          {!form.accountId && (
            <Field label="Lo que llevas ahorrado" error={errors.manualSaved}>
              {(props) => <input {...props} className="input" inputMode="decimal" placeholder="0,00" value={form.manualSaved} onChange={(event) => update({ manualSaved: event.target.value })} />}
            </Field>
          )}
        </form>
      </Sheet>
      {confirmDelete && (
        <ConfirmDialog
          title="¿Archivar esta meta?"
          message="Deja de mostrarse y de avisarte. Tu dinero y tus movimientos no cambian."
          confirmLabel="Archivar"
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

export function GoalsPage({ ledger }) {
  const { goals, accounts, categories, actions } = ledger;
  const day = today();
  const [sheet, setSheet] = useState(null);
  const [recurringDefaults, setRecurringDefaults] = useState(null);
  const active = goals.filter((goal) => !goal.archivedAt).map((goal) => ({ goal, progress: goalProgress(goal, ledger, day) }));
  const main = accounts.find((account) => !account.archivedAt && !account.isSavings && !isDebt(account));

  return (
    <div className="page">
      <div className="page-head">
        <h1>Metas de ahorro</h1>
        <button type="button" className="btn btn-primary" onClick={() => setSheet({})}><Icon name="plus" size={18} /> Nueva meta</button>
      </div>

      {!active.length && (
        <section className="card"><p className="empty">Crea una meta (viaje, carro, fondo de emergencia…) y te digo cuánto ahorrar cada mes para llegar a tiempo.</p></section>
      )}

      <ul className="goal-list">
        {active.map(({ goal, progress }) => {
          const [label, tone] = progress.status ? statusText[progress.status] : [null, null];
          return (
            <li key={goal.id} className="card goal-card">
              <div className="card-head">
                <h2>{goal.name}</h2>
                <button type="button" className="link" onClick={() => setSheet({ existing: goal })}>Editar</button>
              </div>
              <p className="goal-amounts"><strong>{formatCents(progress.saved)}</strong> de {formatCents(goal.targetCents)} · {pctText(progress.pct)}</p>
              <ProgressBar value={progress.pct} tone={progress.done ? 'good' : 'normal'} />
              <p className="form-hint">
                {progress.account ? `En ${progress.account.name}` : 'Anotado a mano'}
                {goal.deadline ? ` · hasta el ${shortDate(goal.deadline)}` : ' · sin fecha límite'}
                {label && <> · <span className={`status-pill status-${tone}`}>{label}</span></>}
              </p>
              {goal.deadline && !progress.done && (
                <p>
                  Para llegar a tiempo ahorra <strong>{formatCents(progress.monthly)} al mes</strong>
                  {progress.months > 0 ? ` durante ${progress.months} mes(es)` : ''}
                  {progress.account?.interestRate ? ', contando el interés de la cuenta' : ''}.
                </p>
              )}
              {goal.deadline && !progress.done && progress.account && progress.monthly > 0 && main && (
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  onClick={() => setRecurringDefaults({
                    name: `Ahorro: ${goal.name}`, kind: 'transferencia', amount: centsToInput(progress.monthly), accountId: main.id,
                    toAccountId: progress.account.id, frequency: 'mensual', startDate: addDays(day, 1), endDate: goal.deadline,
                  })}
                >
                  Ahorrar esto cada mes
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {sheet && <GoalSheet existing={sheet.existing} accounts={accounts} onSave={actions.saveGoal} onDelete={actions.archiveGoal} onClose={() => setSheet(null)} />}
      {recurringDefaults && (
        <RecurringSheet defaults={recurringDefaults} accounts={accounts} categories={categories} onSave={actions.saveRecurring} onClose={() => setRecurringDefaults(null)} />
      )}
    </div>
  );
}

// Rendimientos -----------------------------------------------------------------------------

export function YieldsPage({ ledger, navigate }) {
  const day = today();
  const rows = ledger.accounts.filter((account) => account.earnsInterest && !account.archivedAt).map((account) => {
    const history = interestHistory(account, ledger.transactions);
    return {
      account,
      totals: interestTotals(history, day),
      estimate: interestEstimate(account, ledger.transactions, ledger.balances[account.id] ?? 0, day),
    };
  });
  const sum = (selector) => sumCents(rows, selector);

  return (
    <div className="page">
      <div className="page-head"><h1>Rendimientos</h1></div>
      {!rows.length ? (
        <section className="card">
          <p className="empty">Ninguna cuenta está marcada como que genera intereses. Edita tu cuenta de ahorros o inversión y marca "Esta cuenta genera intereses".</p>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/cuentas')}>Ir a Cuentas</button>
        </section>
      ) : (
        <>
          <section className="stat-grid" aria-label="Totales de intereses">
            <div className="stat"><span className="stat-label">Ganado este año</span><strong className="stat-value">{formatCents(sum((row) => row.totals.year))}</strong></div>
            <div className="stat"><span className="stat-label">Estimado de {monthLabel(monthKey(day)).toLowerCase()}</span><strong className="stat-value">≈ {formatCents(sum((row) => row.estimate?.cents ?? 0))}</strong></div>
            <div className="stat"><span className="stat-label">Ganado en total</span><strong className="stat-value">{formatCents(sum((row) => row.totals.all))}</strong></div>
          </section>
          <section className="card">
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th scope="col">Cuenta</th><th scope="col">Último mes</th><th scope="col">Este año</th><th scope="col">Estimado este mes</th></tr></thead>
                <tbody>
                  {rows.map(({ account, totals, estimate }) => (
                    <tr key={account.id}>
                      <td><button type="button" className="link" onClick={() => navigate(`/cuentas/${account.id}`)}>{account.name}</button></td>
                      <td>{totals.last ? `${formatCents(totals.last.cents)} (${totals.last.label.split(' ')[0].toLowerCase()})` : '—'}</td>
                      <td>{formatCents(totals.year)}</td>
                      <td>{estimate ? `≈ ${formatCents(estimate.cents)}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="form-hint">Para anotar el interés de un mes, abre la cuenta → pestaña Intereses → "Anotar interés".</p>
          </section>
        </>
      )}
    </div>
  );
}
