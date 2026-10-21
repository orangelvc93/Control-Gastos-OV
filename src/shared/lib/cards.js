import { sumCents } from './cents';
import { activeTransactions, countsForBalance } from './ledger';

// Tarjetas de crédito: ciclos de corte, diferidos y estado de cuenta. Todo en centavos.
// Misma lógica que las funciones card_* de supabase/fase3_tarjetas.sql (intereses y avisos del servidor).

function iso(year, monthIndex, day) {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  const date = new Date(year, monthIndex, Math.min(day, last));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parts(date) {
  const [year, month, day] = date.split('-').map(Number);
  return { year, monthIndex: month - 1, day };
}

// El día de corte en meses cortos cae el último día (corte 31 → 30 de abril).
export function shiftCut(cut, months, statementDay) {
  const { year, monthIndex } = parts(cut);
  return iso(year, monthIndex + months, statementDay);
}

// Corte que incluye esa fecha: el mismo día de corte entra en ese estado de cuenta.
export function cutOnOrAfter(date, statementDay) {
  const { year, monthIndex } = parts(date);
  const cut = iso(year, monthIndex, statementDay);
  return cut >= date ? cut : iso(year, monthIndex + 1, statementDay);
}

export function cutOnOrBefore(date, statementDay) {
  const { year, monthIndex } = parts(date);
  const cut = iso(year, monthIndex, statementDay);
  return cut <= date ? cut : iso(year, monthIndex - 1, statementDay);
}

// Fecha máxima de pago: el siguiente día de pago después del corte (corte 23 → pago 8 del mes siguiente).
export function dueDateFor(cut, dueDay, statementDay) {
  const { year, monthIndex } = parts(cut);
  return dueDay > statementDay ? iso(year, monthIndex, dueDay) : iso(year, monthIndex + 1, dueDay);
}

export function daysBetween(from, to) {
  const a = parts(from);
  const b = parts(to);
  return Math.round((Date.UTC(b.year, b.monthIndex, b.day) - Date.UTC(a.year, a.monthIndex, a.day)) / 86400000);
}

export function cardReady(account) {
  return Boolean(account.statementDay && account.dueDay);
}

// Tasa mensual de la tarjeta (diferidos con intereses): nominal ÷ 12 o equivalente de la efectiva anual.
export function monthlyRate(account) {
  if (!account.interestRate) return null;
  const annual = account.interestRate / 100;
  return account.rateType === 'efectiva' ? (1 + annual) ** (1 / 12) - 1 : annual / 12;
}

// Factor del banco para diferidos con intereses (interés total = monto × factor), si la tarjeta lo tiene para ese plazo.
export function deferralFactor(account, months) {
  const factor = Number(account.deferralFactors?.[months]);
  return factor > 0 ? factor : null;
}

// ¿Se puede diferir con intereses a ese plazo? Hace falta el factor del banco o la tasa de la tarjeta.
export function canChargeInterest(account, months) {
  return Boolean(deferralFactor(account, months) || monthlyRate(account));
}

// Reparte un total en n partes enteras; el sobrante va en la última.
function split(total, parts) {
  const base = Math.floor(total / parts);
  return Array.from({ length: parts }, (_, index) => (index === parts - 1 ? total - base * (parts - 1) : base));
}

// Cuotas de un diferido: n.º, corte en que se cobra, capital, interés y saldo después.
// Sin intereses: cuotas iguales (el centavo que sobra va en la última).
// Con intereses: con el factor del banco (interés total = monto × factor, repartido en cuotas iguales);
// si la tarjeta no tiene factor para ese plazo, sistema francés con la tasa de la tarjeta.
export function installmentSchedule(plan, account) {
  const factor = plan.withInterest ? deferralFactor(account, plan.months) : null;
  if (factor) {
    const capitals = split(plan.principalCents, plan.months);
    const interests = split(Math.round((plan.principalCents * factor) / 100), plan.months);
    let left = plan.principalCents;
    return capitals.map((capital, index) => {
      left -= capital;
      return {
        n: index + 1, cut: shiftCut(plan.firstCut, index, account.statementDay), capital, interest: interests[index],
        payment: capital + interests[index], balanceAfter: left,
      };
    });
  }

  const rate = plan.withInterest ? monthlyRate(account) : null;
  const rows = [];
  let balance = plan.principalCents;
  const payment = rate
    ? Math.round((plan.principalCents * rate) / (1 - (1 + rate) ** -plan.months))
    : Math.floor(plan.principalCents / plan.months);

  for (let n = 1; n <= plan.months; n += 1) {
    const interest = rate ? Math.round(balance * rate) : 0;
    const capital = n === plan.months ? balance : Math.min(balance, payment - interest);
    balance -= capital;
    rows.push({ n, cut: shiftCut(plan.firstCut, n - 1, account.statementDay), capital, interest, payment: capital + interest, balanceAfter: balance });
  }
  return rows;
}

// Diferidos vigentes: los que ya tenías al empezar (dentro del saldo inicial) o cuya compra sigue activa.
export function activePlans(plans, account, transactions) {
  const purchases = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  return plans
    .filter((plan) => plan.accountId === account.id && !plan.archivedAt)
    .map((plan) => {
      const purchase = plan.transactionId ? purchases.get(plan.transactionId) : null;
      return { ...plan, purchase, since: plan.inOpening ? account.openingDate : purchase?.date };
    })
    .filter((plan) => plan.inOpening || (plan.purchase && !plan.purchase.deletedAt));
}

// Capital de diferidos que todavía no te cobran después de ese corte (está en la deuda, pero no se paga en este estado).
export function unbilledCapital(plans, account, cut) {
  return sumCents(plans.filter((plan) => plan.since && plan.since <= cut), (plan) => (
    sumCents(installmentSchedule(plan, account).filter((row) => row.cut > cut), (row) => row.capital)
  ));
}

// Deuda (positiva) al final de ese día. Antes del saldo inicial no hay datos: se usa el saldo inicial.
export function debtAt(account, transactions, date) {
  const counted = activeTransactions(transactions).filter((transaction) => (
    transaction.accountId === account.id
    && transaction.status === 'confirmado'
    && countsForBalance(account, transaction)
    && transaction.date <= date
  ));
  return -(account.openingCents + sumCents(counted, (transaction) => transaction.cents));
}

function payableAt(account, transactions, plans, cut) {
  return Math.max(0, debtAt(account, transactions, cut) - unbilledCapital(plans, account, cut));
}

const isPayment = (transaction) => transaction.kind === 'transferencia' && transaction.cents > 0;

// Estado de cuenta del corte `cut`: qué se cobra, cuánto pagar y hasta cuándo.
// total = saldo anterior + consumos corrientes + cuotas + intereses + otros − pagos − devoluciones.
export function statementFor(account, { transactions, installments, statements }, cut) {
  const plans = activePlans(installments, account, transactions);
  const prevCut = shiftCut(cut, -1, account.statementDay);
  const due = dueDateFor(cut, account.dueDay, account.statementDay);
  const planPurchases = new Set(plans.map((plan) => plan.transactionId).filter(Boolean));
  const inCycle = activeTransactions(transactions).filter((transaction) => (
    transaction.accountId === account.id
    && transaction.status === 'confirmado'
    && countsForBalance(account, transaction)
    && transaction.date > prevCut
    && transaction.date <= cut
  ));

  const installmentsDue = plans.flatMap((plan) => installmentSchedule(plan, account)
    .filter((row) => row.cut === cut && plan.since <= cut)
    .map((row) => ({ plan, row })));
  const interests = inCycle.filter((transaction) => transaction.installmentId);
  const purchases = inCycle.filter((transaction) => transaction.kind === 'gasto' && !transaction.installmentId && !planPurchases.has(transaction.id));
  const deferredPurchases = inCycle.filter((transaction) => planPurchases.has(transaction.id));
  const payments = inCycle.filter(isPayment);
  const refunds = inCycle.filter((transaction) => transaction.kind === 'ingreso');
  const others = inCycle.filter((transaction) => !isPayment(transaction) && transaction.kind !== 'ingreso' && transaction.kind !== 'gasto');

  const total = payableAt(account, transactions, plans, cut);
  const previous = prevCut < account.openingDate
    // Del saldo inicial solo se restan los diferidos que ya venían dentro de él (no las compras hechas después).
    ? Math.max(0, -account.openingCents - unbilledCapital(plans.filter((plan) => plan.inOpening), account, account.openingDate))
    : payableAt(account, transactions, plans, prevCut);

  const record = statements.find((item) => item.accountId === account.id && item.cutDate === cut);
  const estimatedMinimum = Math.min(total, Math.round((total * (account.minPaymentPct ?? 10)) / 100));
  const minimum = record?.minPaymentCents ?? estimatedMinimum;
  const paidSinceCut = sumCents(activeTransactions(transactions).filter((transaction) => (
    transaction.accountId === account.id && transaction.status === 'confirmado' && isPayment(transaction) && transaction.date > cut
  )), (transaction) => transaction.cents);

  return {
    cut,
    prevCut,
    due,
    firstInApp: prevCut < account.openingDate,
    previous,
    purchases,
    deferredPurchases,
    installmentsDue,
    interests,
    payments,
    refunds,
    others,
    total,
    minimum,
    minimumEstimated: record?.minPaymentCents == null,
    bankTotalCents: record?.bankTotalCents ?? null,
    paidSinceCut,
    remaining: Math.max(0, total - paidSinceCut),
    minimumRemaining: Math.max(0, minimum - paidSinceCut),
  };
}

// Cortes con estado de cuenta en la app: desde el primero después del saldo inicial hasta el próximo (en curso).
export function statementCuts(account, today) {
  const first = cutOnOrAfter(account.openingDate, account.statementDay);
  const next = cutOnOrAfter(today, account.statementDay);
  const cuts = [];
  for (let cut = first; cut <= next && cuts.length < 240; cut = shiftCut(cut, 1, account.statementDay)) cuts.push(cut);
  return cuts;
}

// Qué toca hacer hoy con la tarjeta.
//   sin-estado: todavía no hubo un corte desde que empezaste a usar la app
//   por-pagar / pagado / atrasado: según el último estado de cuenta y lo pagado después del corte
export function cardStatus(account, ledger, today) {
  const lastCut = cutOnOrBefore(today, account.statementDay);
  const nextCut = cutOnOrAfter(addOne(today), account.statementDay);
  if (lastCut < account.openingDate) return { kind: 'sin-estado', nextCut, nextDue: dueDateFor(nextCut, account.dueDay, account.statementDay) };

  const statement = statementFor(account, ledger, lastCut);
  if (statement.remaining === 0) return { kind: 'pagado', statement, nextCut };
  if (today <= statement.due) return { kind: 'por-pagar', statement, nextCut, daysLeft: daysBetween(today, statement.due) };
  return { kind: 'atrasado', statement, nextCut, belowMinimum: statement.minimumRemaining > 0 };
}

function addOne(date) {
  const { year, monthIndex, day } = parts(date);
  return iso(year, monthIndex, day + 1);
}

// Interés aproximado si queda saldo sin pagar: interés diario desde la fecha máxima de pago hasta el siguiente corte.
export function partialPaymentInterest(account, unpaidCents, due, nextCut) {
  if (!account.interestRate || unpaidCents <= 0) return null;
  const days = Math.max(0, daysBetween(due, nextCut));
  const daily = account.interestRate / 100 / (account.dayBasis || 360);
  return { cents: Math.round(unpaidCents * daily * days), days };
}

// Resumen de cada diferido para la lista: cuota, cuotas cobradas, saldo y última fecha.
export function planSummary(plan, account, today) {
  const rows = installmentSchedule(plan, account);
  const billed = rows.filter((row) => row.cut <= today).length;
  return {
    rows,
    payment: rows[0]?.payment ?? 0,
    billed,
    pendingCapital: sumCents(rows.filter((row) => row.cut > today), (row) => row.capital),
    totalInterest: sumCents(rows, (row) => row.interest),
    lastCut: rows.at(-1)?.cut,
    finished: billed >= plan.months,
  };
}
