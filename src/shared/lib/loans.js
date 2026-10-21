import { sumCents } from './cents';
import { shiftCut } from './cards';
import { accountBreakdown, activeTransactions } from './ledger';

// Créditos y préstamos. Todo en centavos. Misma lógica que generate_loan_installments (supabase/fase3b_creditos.sql):
// el interés de cada cuota se calcula sobre la deuda real antes de pagarla.

export const loanKindLabels = {
  bancario: 'Bancario',
  consumo: 'Consumo',
  vehicular: 'Vehicular',
  hipotecario: 'Hipotecario',
  personal: 'Personal / familiar',
};

export const loanSystemLabels = {
  frances: 'Francés (cuota fija)',
  aleman: 'Alemán (capital fijo, cuota que baja)',
};

export function loanMonthlyRate(loan) {
  if (!loan.annualRate) return 0;
  const annual = loan.annualRate / 100;
  return loan.rateType === 'efectiva' ? (1 + annual) ** (1 / 12) - 1 : annual / 12;
}

// Cuota del sistema francés (sin seguros) para pagar `balance` en `months` cuotas.
export function frenchPayment(balanceCents, rate, months) {
  if (months <= 0) return balanceCents;
  if (!rate) return Math.ceil(balanceCents / months);
  return Math.round((balanceCents * rate) / (1 - (1 + rate) ** -months));
}

// Monto de cuota que se guarda: cuota fija (francés) o capital fijo (alemán).
export function initialPaymentAmount({ system, rate, balanceCents, months }) {
  return system === 'aleman' ? Math.ceil(balanceCents / months) : frenchPayment(balanceCents, rate, months);
}

export function paymentDate(loan, index) {
  return shiftCut(loan.firstPaymentDate, index, loan.paymentDay);
}

// Proyección de cuotas desde una deuda: n.º, fecha, interés, capital, seguros, cuota y saldo.
// startIndex: posición (0 = first_payment_date) de la próxima cuota; number = paid_before + startIndex + 1.
export function projectSchedule(loan, debtCents, startIndex, paymentAmountCents = loan.paymentAmountCents) {
  const rate = loanMonthlyRate(loan);
  const rows = [];
  let balance = debtCents;
  for (let index = startIndex; balance > 0 && loan.paidBefore + index < loan.termMonths; index += 1) {
    const number = loan.paidBefore + index + 1;
    const interest = Math.round(balance * rate);
    let capital;
    if (number === loan.termMonths) capital = balance;
    else if (loan.system === 'aleman') capital = Math.min(balance, paymentAmountCents);
    else capital = Math.min(balance, Math.max(0, paymentAmountCents - interest));
    if (capital <= 0 && interest >= paymentAmountCents) break; // la cuota no alcanza ni para el interés
    balance -= capital;
    rows.push({
      number, date: paymentDate(loan, index), interest, capital, fee: loan.monthlyFeeCents,
      payment: interest + capital + loan.monthlyFeeCents, balanceAfter: balance, projected: true,
    });
  }
  return rows;
}

// Estado actual del crédito a partir de sus movimientos.
export function loanState(loan, account, transactions) {
  const own = activeTransactions(transactions).filter((transaction) => transaction.loanId === loan.id);
  const byNumber = new Map();
  for (const transaction of own) {
    const row = byNumber.get(transaction.loanNo) ?? {
      number: transaction.loanNo, date: transaction.date, interest: 0, capital: 0, fee: 0, pending: false,
    };
    if (transaction.kind === 'gasto' && transaction.description.startsWith('Interés')) row.interest -= transaction.cents;
    else if (transaction.kind === 'gasto') row.fee -= transaction.cents;
    else if (transaction.kind === 'transferencia' && transaction.accountId === account.id) row.capital += transaction.cents;
    if (transaction.status === 'pendiente') row.pending = true;
    byNumber.set(transaction.loanNo, row);
  }
  const paid = [...byNumber.values()].sort((a, b) => a.number - b.number).map((row) => ({ ...row, payment: row.interest + row.capital + row.fee }));
  const debt = -accountBreakdown(account, transactions).balance;
  const registered = paid.length;

  // La próxima cuota es la primera posición cuya fecha no se registró todavía.
  let nextIndex = 0;
  while (loan.paidBefore + nextIndex < loan.termMonths && byNumber.has(loan.paidBefore + nextIndex + 1)) nextIndex += 1;

  const future = debt > 0 ? projectSchedule(loan, debt, nextIndex) : [];
  const paidCount = loan.paidBefore + registered;

  return {
    debt,
    paid,
    future,
    paidCount,
    next: future[0] ?? null,
    endDate: future.at(-1)?.date ?? paid.at(-1)?.date ?? null,
    interestPaid: sumCents(paid, (row) => row.interest),
    interestLeft: sumCents(future, (row) => row.interest),
    totalLeft: sumCents(future, (row) => row.payment),
    nextIndex,
    finished: debt <= 0,
  };
}

// Simulador de abono extra: compara reducir el plazo (misma cuota) con reducir la cuota (mismo plazo).
export function simulateExtra(loan, state, extraCents) {
  const base = state.future;
  const newDebt = state.debt - extraCents;
  if (extraCents <= 0 || newDebt < 0) return null;
  const remainingMonths = loan.termMonths - state.paidCount;
  const rate = loanMonthlyRate(loan);
  const shorter = projectSchedule(loan, newDebt, state.nextIndex);
  const newPayment = loan.system === 'aleman'
    ? Math.ceil(newDebt / Math.max(1, remainingMonths))
    : frenchPayment(newDebt, rate, remainingMonths);
  const lower = projectSchedule(loan, newDebt, state.nextIndex, newPayment);
  const baseInterest = sumCents(base, (row) => row.interest);
  const summary = (rows) => ({
    months: rows.length,
    endDate: rows.at(-1)?.date ?? null,
    interest: sumCents(rows, (row) => row.interest),
    saved: baseInterest - sumCents(rows, (row) => row.interest),
    payment: rows[0] ? rows[0].interest + rows[0].capital : 0,
  });
  return {
    base: summary(base),
    plazo: { ...summary(shorter), monthsSaved: base.length - shorter.length },
    cuota: { ...summary(lower), newPayment },
  };
}
