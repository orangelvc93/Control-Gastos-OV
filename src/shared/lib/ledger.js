import { sumCents } from './cents';

// Cálculos del libro contable. Todo en centavos; nada se redondea hasta formatear.

export const accountTypeLabels = {
  corriente: 'Corriente',
  ahorro: 'Ahorros',
  efectivo: 'Efectivo',
  tarjeta_credito: 'Tarjeta de crédito',
  inversion: 'Inversión',
  poliza: 'Póliza',
  prestamo: 'Crédito o préstamo',
};

export const sriCategoryLabels = {
  vivienda: 'Vivienda',
  salud: 'Salud',
  educacion: 'Educación, arte y cultura',
  alimentacion: 'Alimentación',
  vestimenta: 'Vestimenta',
  turismo: 'Turismo',
};

export const kindLabels = {
  gasto: 'Gasto',
  ingreso: 'Ingreso',
  transferencia: 'Transferencia',
  ajuste: 'Ajuste de saldo',
};

export const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export function isCard(account) {
  return account.type === 'tarjeta_credito';
}

export function isLoan(account) {
  return account.type === 'prestamo';
}

// Cuentas de deuda (tarjetas y créditos): su saldo es negativo y se muestra como "Deuda".
export function isDebt(account) {
  return isCard(account) || isLoan(account);
}

export function activeTransactions(transactions) {
  return transactions.filter((transaction) => !transaction.deletedAt);
}

// El saldo inicial ya incluye todo lo ocurrido antes de su fecha: un movimiento anterior no lo cambia
// (si contara, se sumaría dos veces). Misma regla que la vista account_balances.
export function countsForBalance(account, transaction) {
  return transaction.date >= account.openingDate;
}

// Desglose del saldo de una cuenta, para poder explicar de dónde sale cada número.
export function accountBreakdown(account, transactions) {
  const own = activeTransactions(transactions).filter((transaction) => transaction.accountId === account.id && countsForBalance(account, transaction));
  const confirmed = own.filter((transaction) => transaction.status === 'confirmado');
  const byKind = (kind) => sumCents(confirmed.filter((transaction) => transaction.kind === kind), (transaction) => transaction.cents);
  const income = byKind('ingreso');
  const expenses = byKind('gasto');
  const transfers = byKind('transferencia');
  const adjustments = byKind('ajuste');
  const pending = sumCents(own.filter((transaction) => transaction.status === 'pendiente'), (transaction) => transaction.cents);

  return {
    opening: account.openingCents,
    income,
    expenses,
    transfers,
    adjustments,
    pending,
    balance: account.openingCents + income + expenses + transfers + adjustments,
  };
}

export function balancesById(accounts, transactions) {
  return Object.fromEntries(accounts.map((account) => [account.id, accountBreakdown(account, transactions).balance]));
}

// Resumen general: patrimonio neto = lo que tengo − lo que debo (tarjetas y créditos tienen saldo negativo).
export function netWorthSummary(accounts, balances) {
  const open = accounts.filter((account) => !account.archivedAt);
  const cards = open.filter(isCard);
  const debts = open.filter(isDebt);
  const nonCards = open.filter((account) => !isDebt(account));
  const savings = nonCards.filter((account) => account.isSavings);
  const available = nonCards.filter((account) => !account.isSavings);
  const total = (list) => sumCents(list, (account) => balances[account.id] ?? 0);
  const owned = total(nonCards);
  const owed = -total(debts);

  return {
    owned,
    owed,
    netWorth: owned - owed,
    savings: total(savings),
    available: total(available),
    creditAvailable: sumCents(cards, (account) => (account.creditLimitCents ?? 0) + (balances[account.id] ?? 0)),
  };
}

export function monthKey(date) {
  return date.slice(0, 7);
}

export function monthLabel(key) {
  const [year, month] = key.split('-').map(Number);
  return `${monthNames[month - 1]} ${year}`;
}

export function shiftMonth(key, delta) {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// Ingreso disponible: un ingreso cuya categoría cuenta como ingreso. Los aportes que el trabajo deposita
// directo en un fondo (Anefi) suman al saldo de esa cuenta, pero no son dinero que entre para gastar.
export const isAvailableIncome = (transaction) => transaction.kind === 'ingreso' && transaction.countsAsIncome !== false;

// Ingresos y gastos del mes (las transferencias y ajustes no cuentan: no son ingreso ni gasto).
export function monthSummary(transactions, key) {
  const month = activeTransactions(transactions).filter((transaction) => transaction.status === 'confirmado' && monthKey(transaction.date) === key);
  const income = sumCents(month.filter(isAvailableIncome), (transaction) => transaction.cents);
  const expenses = -sumCents(month.filter((transaction) => transaction.kind === 'gasto'), (transaction) => transaction.cents);
  return { income, expenses, balance: income - expenses };
}

// En las listas generales una transferencia se muestra una sola vez (fila de salida), con su cuenta destino.
export function groupForList(transactions) {
  const transferPairs = new Map();
  for (const transaction of transactions) {
    if (!transaction.transferId) continue;
    const pair = transferPairs.get(transaction.transferId) ?? {};
    pair[transaction.cents < 0 ? 'from' : 'to'] = transaction;
    transferPairs.set(transaction.transferId, pair);
  }

  return transactions
    .filter((transaction) => !transaction.transferId || transaction.cents < 0)
    .map((transaction) => (transaction.transferId
      ? { ...transaction, toAccountId: transferPairs.get(transaction.transferId)?.to?.accountId, pairCents: -transaction.cents }
      : transaction));
}

export function groupByDate(items) {
  const groups = [];
  for (const item of items) {
    const last = groups.at(-1);
    if (last && last.date === item.date) last.items.push(item);
    else groups.push({ date: item.date, items: [item] });
  }
  return groups;
}

// Saldo después de cada movimiento de una cuenta (lista de más reciente a más antiguo).
export function withRunningBalance(account, transactions) {
  const own = activeTransactions(transactions)
    .filter((transaction) => transaction.accountId === account.id)
    .sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date)));
  let running = account.openingCents;
  const rows = own.map((transaction) => {
    if (!countsForBalance(account, transaction)) return { ...transaction, runningCents: undefined, beforeOpening: true };
    if (transaction.status === 'confirmado') running += transaction.cents;
    return { ...transaction, runningCents: running };
  });
  return rows.reverse();
}

export function formatDayLabel(date) {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(year, month - 1, day);
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (value.toDateString() === today.toDateString()) return 'Hoy';
  if (value.toDateString() === yesterday.toDateString()) return 'Ayer';
  return value.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' });
}
