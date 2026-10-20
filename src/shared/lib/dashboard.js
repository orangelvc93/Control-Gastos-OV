import { activeTransactions, isCard, monthKey, monthLabel, monthNames, shiftMonth } from './ledger';

// Datos para las gráficas del dashboard. Se calcula en centavos y se pasa a dólares solo al final.
const toDollars = (cents) => Math.round(cents) / 100;

export const periods = [
  ['mes', 'Este mes', 1],
  ['3m', '3 meses', 3],
  ['6m', '6 meses', 6],
  ['12m', '12 meses', 12],
  ['anio', 'Este año', null],
];

export function periodMonths(periodKey, todayKey) {
  const [key, , count] = periods.find(([value]) => value === periodKey) ?? periods[0];
  const months = key === 'anio' ? Number(todayKey.slice(5, 7)) : count;
  return Array.from({ length: months }, (_, index) => shiftMonth(todayKey, index - months + 1));
}

function shortMonth(key) {
  const month = Number(key.slice(5, 7));
  return monthNames[month - 1].slice(0, 3);
}

function confirmedIn(transactions, months) {
  const set = new Set(months);
  return activeTransactions(transactions).filter((item) => item.status === 'confirmado' && set.has(monthKey(item.date)));
}

export function periodTotals(transactions, months) {
  const items = confirmedIn(transactions, months);
  const income = items.filter((item) => item.kind === 'ingreso').reduce((total, item) => total + item.cents, 0);
  const expenses = -items.filter((item) => item.kind === 'gasto').reduce((total, item) => total + item.cents, 0);
  return {
    income,
    expenses,
    saved: income - expenses,
    savingRate: income > 0 ? ((income - expenses) / income) * 100 : null,
  };
}

export function monthlyIncomeExpenses(transactions, months) {
  const items = confirmedIn(transactions, months);
  return months.map((key) => {
    const month = items.filter((item) => monthKey(item.date) === key);
    const income = month.filter((item) => item.kind === 'ingreso').reduce((total, item) => total + item.cents, 0);
    const expenses = -month.filter((item) => item.kind === 'gasto').reduce((total, item) => total + item.cents, 0);
    return { key, label: shortMonth(key), fullLabel: monthLabel(key), ingresos: toDollars(income), gastos: toDollars(expenses) };
  });
}

// Total por categoría, de mayor a menor; a partir de la 8.ª se agrupan en "Otras".
export function totalsByCategory(transactions, months, categories, kind) {
  const names = Object.fromEntries(categories.map((category) => [category.id, category.name]));
  const totals = new Map();
  for (const item of confirmedIn(transactions, months).filter((transaction) => transaction.kind === kind)) {
    totals.set(item.categoryId, (totals.get(item.categoryId) ?? 0) + Math.abs(item.cents));
  }
  const sorted = [...totals.entries()]
    .map(([id, cents]) => ({ name: names[id] ?? 'Sin categoría', cents }))
    .sort((a, b) => b.cents - a.cents);
  const top = sorted.slice(0, 7);
  const rest = sorted.slice(7).reduce((total, item) => total + item.cents, 0);
  if (rest > 0) top.push({ name: 'Otras', cents: rest });
  const grand = sorted.reduce((total, item) => total + item.cents, 0);
  return top.map((item) => ({ ...item, value: toDollars(item.cents), share: grand ? (item.cents / grand) * 100 : 0 }));
}

function addDays(iso, days) {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Patrimonio neto (todas las cuentas abiertas, las tarjetas restan) al cierre de cada día del periodo.
// Una cuenta cuenta desde su fecha de inicio.
export function netWorthSeries(accounts, transactions, months, todayIso) {
  const open = accounts.filter((account) => !account.archivedAt);
  const openingById = Object.fromEntries(open.map((account) => [account.id, account.openingDate]));
  const confirmed = activeTransactions(transactions)
    .filter((item) => item.status === 'confirmado' && openingById[item.accountId] && item.date >= openingById[item.accountId])
    .sort((a, b) => a.date.localeCompare(b.date));
  const firstOpening = open.map((account) => account.openingDate).sort()[0];
  if (!firstOpening) return [];

  const start = `${months[0]}-01` > firstOpening ? `${months[0]}-01` : firstOpening;
  const points = [];
  let index = 0;
  let running = 0;
  for (const item of confirmed) if (item.date < start) running += item.cents;
  while (index < confirmed.length && confirmed[index].date < start) index += 1;

  for (let date = start; date <= todayIso; date = addDays(date, 1)) {
    while (index < confirmed.length && confirmed[index].date === date) {
      running += confirmed[index].cents;
      index += 1;
    }
    const opening = open.filter((account) => account.openingDate <= date).reduce((total, account) => total + account.openingCents, 0);
    points.push({ date, label: date.split('-').reverse().slice(0, 2).join('/'), patrimonio: toDollars(opening + running) });
  }
  return points;
}

export function accountBalanceBars(accounts, balances) {
  return accounts
    .filter((account) => !account.archivedAt && !isCard(account))
    .map((account) => ({ name: account.name, value: toDollars(balances[account.id] ?? 0) }))
    .sort((a, b) => b.value - a.value);
}

export function cardUsage(accounts, balances) {
  return accounts
    .filter((account) => !account.archivedAt && isCard(account))
    .map((account) => {
      const debt = -(balances[account.id] ?? 0);
      const limit = account.creditLimitCents ?? 0;
      return { name: account.name, debt, limit, percent: limit ? Math.max(0, (debt / limit) * 100) : null };
    });
}
