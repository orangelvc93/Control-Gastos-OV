import { monthlyRate as cardMonthlyRate } from './cards';
import { sumCents } from './cents';
import { activeTransactions, isAvailableIncome, isCard, monthKey, shiftMonth } from './ledger';
import { frenchPayment, loanMonthlyRate, loanState } from './loans';

// Plan para salir de deudas: lista consolidada, endeudamiento y simulación avalancha vs. bola de nieve. Todo en centavos.

export const HEALTHY_DEBT_PCT = 30;
export const HIGH_DEBT_PCT = 35;
const CARD_MIN_FLOOR = 1000; // $10: mínimo de pago de una tarjeta aunque el % dé menos
const MAX_MONTHS = 600;

// Mínimo estimado de una tarjeta para un saldo: % de la tarjeta, nunca menos de $10 (o el saldo si es menor).
function cardMinimum(balance, pct) {
  return Math.min(balance, Math.max(Math.round((balance * pct) / 100), CARD_MIN_FLOOR));
}

// Todas las deudas abiertas: saldo, tasa, pago mensual y fecha estimada de fin.
export function debtList({ accounts, loans, transactions, balances }) {
  const open = accounts.filter((account) => !account.archivedAt);
  const cards = open.filter((account) => isCard(account) && -(balances[account.id] ?? 0) > 0).map((account) => {
    const balance = -(balances[account.id] ?? 0);
    const rate = cardMonthlyRate(account) ?? 0;
    return {
      id: account.id, name: account.name, kind: 'tarjeta', balance, rate, annualRate: account.interestRate ?? null,
      minPct: account.minPaymentPct ?? 10, monthlyPayment: cardMinimum(balance, account.minPaymentPct ?? 10), fee: 0,
    };
  });
  const loanDebts = loans.filter((loan) => !loan.archivedAt).flatMap((loan) => {
    const account = open.find((item) => item.id === loan.accountId);
    if (!account) return [];
    const state = loanState(loan, account, transactions);
    if (state.debt <= 0) return [];
    return [{
      id: account.id, name: account.name, kind: 'credito', balance: state.debt, rate: loanMonthlyRate(loan), annualRate: loan.annualRate,
      system: loan.system, paymentAmount: loan.paymentAmountCents, fee: loan.monthlyFeeCents,
      monthlyPayment: state.next ? state.next.payment : loan.paymentAmountCents + loan.monthlyFeeCents, endDate: state.endDate,
    }];
  });
  return [...cards, ...loanDebts];
}

// Ingreso mensual: el que anotaste o el promedio de ingresos confirmados de los últimos 3 meses completos.
export function monthlyIncome(transactions, settings, today) {
  if (settings?.monthlyIncomeCents) return { cents: settings.monthlyIncomeCents, source: 'anotado' };
  const current = monthKey(today);
  const months = [1, 2, 3].map((delta) => shiftMonth(current, -delta));
  const income = activeTransactions(transactions).filter((transaction) => isAvailableIncome(transaction) && transaction.status === 'confirmado');
  const totals = months.map((month) => sumCents(income.filter((transaction) => monthKey(transaction.date) === month), (transaction) => transaction.cents));
  const withData = totals.filter((total) => total > 0);
  if (withData.length) return { cents: Math.round(sumCents(withData) / withData.length), source: 'promedio', months: withData.length };
  const thisMonth = sumCents(income.filter((transaction) => monthKey(transaction.date) === current), (transaction) => transaction.cents);
  return thisMonth > 0 ? { cents: thisMonth, source: 'este-mes' } : { cents: 0, source: 'sin-datos' };
}

export function debtRatio(monthlyPaymentCents, incomeCents) {
  if (!incomeCents) return null;
  const pct = (monthlyPaymentCents / incomeCents) * 100;
  return { pct, level: pct > HIGH_DEBT_PCT ? 'alto' : pct > HEALTHY_DEBT_PCT ? 'cuidado' : 'sano' };
}

// Pago mínimo de este mes de una deuda (después de sumarle el interés del mes).
function minimumFor(debt, balance, interest) {
  if (debt.kind === 'tarjeta') return cardMinimum(balance, debt.minPct);
  const payment = debt.system === 'aleman' ? debt.paymentAmount + interest : debt.paymentAmount;
  return Math.min(balance, payment);
}

// Simulación mes a mes:
//   1) cada deuda suma su interés del mes · 2) se paga el mínimo de cada una
//   3) el dinero extra (+ los mínimos de las deudas ya terminadas, si rollover) va a la deuda prioritaria:
//      avalancha = mayor tasa primero · bola de nieve = menor saldo primero.
export function simulatePayoff(debts, extraCents, method, { rollover = true } = {}) {
  const items = debts.map((debt) => ({ ...debt, left: debt.balance, freed: 0, paidMonth: null }));
  const series = [{ month: 0, total: sumCents(items, (item) => item.left) }];
  let totalInterest = 0;
  let totalPaid = 0;
  let month = 0;

  while (items.some((item) => item.left > 0) && month < MAX_MONTHS) {
    month += 1;
    let pool = extraCents;
    for (const item of items) {
      if (item.left <= 0) {
        if (rollover) pool += item.freed;
        continue;
      }
      const interest = Math.round(item.left * item.rate);
      item.left += interest;
      totalInterest += interest;
      const minimum = minimumFor(item, item.left, interest);
      item.left -= minimum;
      totalPaid += minimum;
      item.freed = Math.max(item.freed, minimum);
    }
    const order = items.filter((item) => item.left > 0).sort(method === 'avalancha'
      ? (a, b) => b.rate - a.rate || a.left - b.left
      : (a, b) => a.left - b.left || b.rate - a.rate);
    for (const item of order) {
      if (pool <= 0) break;
      const payment = Math.min(pool, item.left);
      item.left -= payment;
      pool -= payment;
      totalPaid += payment;
    }
    for (const item of items) if (item.left <= 0 && item.paidMonth === null) item.paidMonth = month;
    series.push({ month, total: sumCents(items, (item) => Math.max(0, item.left)) });
  }

  return {
    months: month,
    finished: items.every((item) => item.left <= 0),
    totalInterest,
    totalPaid,
    payoffs: items.map((item) => ({ id: item.id, name: item.name, month: item.paidMonth })).sort((a, b) => (a.month ?? Infinity) - (b.month ?? Infinity)),
    series,
  };
}

// Las tres estrategias juntas para comparar (la base es pagar solo los mínimos, sin dinero extra).
export function comparePlans(debts, extraCents) {
  return {
    minimos: simulatePayoff(debts, 0, 'avalancha', { rollover: false }),
    avalancha: simulatePayoff(debts, extraCents, 'avalancha'),
    bola: simulatePayoff(debts, extraCents, 'bola'),
  };
}

// Simulador de un crédito o diferido nuevo: cuota y cómo cambia el % de endeudamiento.
export function newDebtImpact({ amountCents, annualRate, months }, currentMonthlyCents, incomeCents) {
  const rate = annualRate ? annualRate / 100 / 12 : 0;
  const payment = frenchPayment(amountCents, rate, months);
  return {
    payment,
    totalInterest: rate ? payment * months - amountCents : 0,
    before: debtRatio(currentMonthlyCents, incomeCents),
    after: debtRatio(currentMonthlyCents + payment, incomeCents),
  };
}
