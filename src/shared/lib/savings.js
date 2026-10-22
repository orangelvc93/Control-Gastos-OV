import { sumCents } from './cents';
import { activeTransactions, countsForBalance, isDebt, monthKey, monthLabel, shiftMonth } from './ledger';
import { loanState } from './loans';

// Ahorro: intereses anotados, presupuesto 50/30/20, fondo de emergencia y metas. Todo en centavos.

// Intereses ----------------------------------------------------------------------------

const firstDay = (key) => `${key}-01`;

function lastDay(key) {
  const [year, month] = key.split('-').map(Number);
  return `${key}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
}

function daysIn(key) {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

// Saldo promedio diario de la cuenta en un mes (antes del saldo inicial no hay datos: se usa el saldo inicial).
// El propio interés del mes no entra (llega el último día y no generó intereses ese mes).
export function averageBalance(account, transactions, key) {
  const own = activeTransactions(transactions)
    .filter((transaction) => transaction.accountId === account.id && transaction.status === 'confirmado'
      && countsForBalance(account, transaction) && !(transaction.interestAccount === account.id && transaction.interestMonth === firstDay(key)))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  let balance = account.openingCents + sumCents(own.filter((transaction) => transaction.date < firstDay(key)), (transaction) => transaction.cents);
  const inMonth = own.filter((transaction) => transaction.date >= firstDay(key) && transaction.date <= lastDay(key));
  let total = 0;
  let index = 0;
  for (let day = 1; day <= daysIn(key); day += 1) {
    const date = `${key}-${String(day).padStart(2, '0')}`;
    while (index < inMonth.length && inMonth[index].date <= date) {
      balance += inMonth[index].cents;
      index += 1;
    }
    total += balance;
  }
  return Math.round(total / daysIn(key));
}

// Intereses anotados de una cuenta, del más reciente al más antiguo, con el rendimiento anual aproximado de cada mes.
export function interestHistory(account, transactions) {
  return activeTransactions(transactions)
    .filter((transaction) => transaction.interestAccount === account.id && transaction.interestMonth)
    .map((transaction) => {
      const key = monthKey(transaction.interestMonth);
      const average = averageBalance(account, transactions, key);
      return {
        id: transaction.id,
        transaction,
        key,
        label: monthLabel(key),
        cents: transaction.cents,
        average,
        // interés del mes ÷ saldo promedio, llevado a un año
        annualPct: average > 0 ? (transaction.cents / average) * (365 / daysIn(key)) * 100 : null,
      };
    })
    .sort((a, b) => (a.key < b.key ? 1 : -1));
}

// Estimado del interés del mes en curso: con la tasa de la cuenta, o con el rendimiento de los últimos meses anotados.
export function interestEstimate(account, transactions, balanceCents, today) {
  const key = monthKey(today);
  const days = daysIn(key);
  if (balanceCents <= 0) return null;
  if (account.interestRate) {
    const rate = account.interestRate / 100;
    const basis = account.dayBasis || 360;
    const factor = account.rateType === 'efectiva' ? (1 + rate) ** (days / basis) - 1 : (rate / basis) * days;
    return { key, label: monthLabel(key), cents: Math.round(balanceCents * factor), source: 'tasa' };
  }
  const recent = interestHistory(account, transactions).filter((row) => row.average > 0).slice(0, 3);
  if (!recent.length) return null;
  const monthlyRate = sumCents(recent, (row) => row.cents / row.average) / recent.length;
  return { key, label: monthLabel(key), cents: Math.round(balanceCents * monthlyRate), source: 'historial', months: recent.length };
}

export function interestTotals(history, today) {
  const year = today.slice(0, 4);
  return {
    year: sumCents(history.filter((row) => row.key.startsWith(year)), (row) => row.cents),
    all: sumCents(history, (row) => row.cents),
    last: history[0] ?? null,
  };
}

// Mes por defecto al anotar: el anterior al actual que todavía no esté anotado (o el actual si ya están todos).
export function suggestedInterestMonth(history, today) {
  const noted = new Set(history.map((row) => row.key));
  for (let delta = 1; delta <= 12; delta += 1) {
    const key = shiftMonth(monthKey(today), -delta);
    if (!noted.has(key)) return key;
  }
  return monthKey(today);
}

export const interestMonthDate = { first: firstDay, last: lastDay };

// Presupuesto 50/30/20 ---------------------------------------------------------------------

const NEEDS_WORDS = ['arriendo', 'alquiler', 'vivienda', 'agua', 'luz', 'electric', 'internet', 'plan', 'celular', 'teléfono', 'telefono', 'gas',
  'aliment', 'super', 'mercado', 'comida', 'salud', 'médic', 'medic', 'farmacia', 'transporte', 'gasolina', 'combustible', 'educación', 'educacion',
  'curso', 'colegio', 'escuela', 'universidad', 'interes', 'interés', 'seguro', 'comision', 'comisión', 'impuesto', 'condominio', 'alicuota', 'alícuota'];

// Propuesta de grupo para una categoría según su nombre (el usuario la puede cambiar).
// Compara por palabras: las claves cortas deben coincidir enteras ("gas" no es "gastos").
export function suggestGroup(category) {
  const words = category.name.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const matches = (key) => words.some((word) => word === key || (key.length >= 4 && word.startsWith(key)));
  return NEEDS_WORDS.some(matches) ? 'necesidad' : 'gusto';
}

// Plan del mes: necesidades y gustos (gastos por grupo de categoría) y ahorro/deudas
// (transferencias desde cuentas del día a día hacia ahorros, tarjetas o créditos).
export function monthPlan({ accounts, categories, transactions }, key, settings, incomeCents) {
  const byId = Object.fromEntries(accounts.map((account) => [account.id, account]));
  const categoryById = Object.fromEntries(categories.map((category) => [category.id, category]));
  const month = activeTransactions(transactions).filter((transaction) => transaction.status === 'confirmado' && monthKey(transaction.date) === key);
  const expenses = month.filter((transaction) => transaction.kind === 'gasto');
  const groupOf = (transaction) => categoryById[transaction.categoryId]?.budgetGroup ?? null;
  const needs = -sumCents(expenses.filter((transaction) => groupOf(transaction) === 'necesidad'), (transaction) => transaction.cents);
  const wants = -sumCents(expenses.filter((transaction) => groupOf(transaction) === 'gusto'), (transaction) => transaction.cents);
  const unclassified = -sumCents(expenses.filter((transaction) => !groupOf(transaction)), (transaction) => transaction.cents);

  const transferPairs = new Map();
  for (const transaction of month.filter((item) => item.transferId)) {
    const pair = transferPairs.get(transaction.transferId) ?? {};
    pair[transaction.cents < 0 ? 'from' : 'to'] = transaction;
    transferPairs.set(transaction.transferId, pair);
  }
  let savings = 0;
  for (const { from, to } of transferPairs.values()) {
    if (!from || !to) continue;
    const source = byId[from.accountId];
    const target = byId[to.accountId];
    if (!source || !target || source.isSavings || isDebt(source)) continue;
    if (target.isSavings || isDebt(target)) savings += to.cents;
  }

  const plan = (pct) => Math.round((incomeCents * pct) / 100);
  return {
    income: incomeCents,
    groups: [
      { key: 'necesidad', label: 'Necesidades', pct: settings.planNeedsPct, planned: plan(settings.planNeedsPct), actual: needs, kind: 'limit' },
      { key: 'gusto', label: 'Gustos', pct: settings.planWantsPct, planned: plan(settings.planWantsPct), actual: wants, kind: 'limit' },
      { key: 'ahorro', label: 'Ahorro y deudas', pct: settings.planSavingsPct, planned: plan(settings.planSavingsPct), actual: savings, kind: 'goal' },
    ],
    unclassified,
  };
}

// Gasto del mes por categoría con presupuesto.
export function categoryBudgets({ categories, transactions }, key) {
  const month = activeTransactions(transactions).filter((transaction) => transaction.status === 'confirmado' && transaction.kind === 'gasto' && monthKey(transaction.date) === key);
  return categories
    .filter((category) => category.kind === 'gasto' && !category.archivedAt)
    .map((category) => {
      const spent = -sumCents(month.filter((transaction) => transaction.categoryId === category.id), (transaction) => transaction.cents);
      const budget = category.monthlyBudgetCents;
      return { category, spent, budget, pct: budget ? (spent / budget) * 100 : null };
    })
    .sort((a, b) => (b.budget ? 1 : 0) - (a.budget ? 1 : 0) || b.spent - a.spent || a.category.name.localeCompare(b.category.name));
}

// Fondo de emergencia --------------------------------------------------------------------

const PER_MONTH = { semanal: 52 / 12, quincenal: 2, mensual: 1, anual: 1 / 12 };

// Gastos fijos al mes: frecuentes de gasto (llevados a mensual) + cuotas de créditos.
export function fixedMonthlyExpenses({ recurring, loans, accounts, transactions }) {
  const recurringCents = sumCents(
    recurring.filter((item) => !item.archivedAt && item.kind === 'gasto'),
    (item) => Math.round(item.cents * (PER_MONTH[item.frequency] ?? 1)),
  );
  const loanCents = sumCents(loans.filter((loan) => !loan.archivedAt), (loan) => {
    const account = accounts.find((item) => item.id === loan.accountId);
    if (!account || account.archivedAt) return 0;
    const state = loanState(loan, account, transactions);
    return state.next?.payment ?? 0;
  });
  return { recurringCents, loanCents, total: recurringCents + loanCents };
}

export function emergencyFund(ledger, settings) {
  const account = ledger.accounts.find((item) => item.id === settings?.emergencyAccountId && !item.archivedAt);
  const fixed = fixedMonthlyExpenses(ledger);
  if (!account) return { account: null, fixed };
  const balance = ledger.balances[account.id] ?? 0;
  return { account, balance, fixed, months: fixed.total > 0 ? balance / fixed.total : null };
}

// Metas ----------------------------------------------------------------------------------

function monthsBetween(from, to) {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return Math.max(0, (ty - fy) * 12 + (tm - fm) + (td >= fd ? 0 : -1));
}

// Avance de una meta: ahorrado, %, aporte mensual necesario (con interés si la cuenta tiene tasa) y si va a tiempo.
export function goalProgress(goal, { accounts, balances }, today) {
  const account = goal.accountId ? accounts.find((item) => item.id === goal.accountId) : null;
  const saved = account ? Math.max(0, balances[account.id] ?? 0) : goal.manualSavedCents;
  const left = Math.max(0, goal.targetCents - saved);
  const pct = Math.min(100, (saved / goal.targetCents) * 100);
  if (!goal.deadline) return { account, saved, left, pct, done: left === 0 };

  const months = monthsBetween(today, goal.deadline);
  const rate = account?.interestRate ? account.interestRate / 100 / 12 : 0;
  let monthly;
  if (left === 0) monthly = 0;
  else if (months <= 0) monthly = left;
  else if (rate) {
    // Aporte A tal que saldo·(1+i)^n + A·((1+i)^n − 1)/i = objetivo
    const growth = (1 + rate) ** months;
    monthly = Math.max(0, Math.ceil(((goal.targetCents - saved * growth) * rate) / (growth - 1)));
  } else monthly = Math.ceil(left / months);

  const totalDays = (Date.parse(goal.deadline) - Date.parse(goal.startDate)) / 86400000;
  const elapsed = (Date.parse(today) - Date.parse(goal.startDate)) / 86400000;
  const expected = totalDays > 0 ? Math.round(goal.targetCents * Math.min(1, Math.max(0, elapsed / totalDays))) : goal.targetCents;
  const status = left === 0 ? 'lograda' : today > goal.deadline ? 'vencida' : saved >= expected ? 'a-tiempo' : expected - saved > goal.targetCents * 0.1 ? 'atrasada' : 'un-poco-atras';
  return { account, saved, left, pct, months, monthly, expected, status, done: left === 0 };
}
