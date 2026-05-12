import { today } from './date';
import { toNumber } from './numbers';

export const suggestedDistribution = [
  { description: 'Comida/Vida', percent: 0.25 },
  { description: 'Ocio', percent: 0.1 },
  { description: 'Gastos Hogar', percent: 0.15 },
  { description: 'Ahorro', percent: 0.5 },
];

export function finalSaving(row) {
  return toNumber(row.initial) + toNumber(row.deposit) + toNumber(row.interest);
}

export function emptyPayment(month) {
  return { date: today(), month, category: '', concept: '', status: 'Pagado', amount: '' };
}

export function emptyIncome(month) {
  return { date: today(), month, source: '', concept: '', type: 'Fijo', status: 'Pagado', amount: '' };
}

export function emptyDebt() {
  return {
    loan: '',
    description: '',
    total: '',
    monthlyPayment: '',
    totalInstallments: '',
    currentInstallment: 0,
    interest: 'Sin interes',
    monthValue: '',
    archived: false,
  };
}

export function hydrateDebt(debt) {
  const totalInstallments = toNumber(debt.totalInstallments);
  const currentInstallment = Math.min(toNumber(debt.currentInstallment), totalInstallments);
  const remainingMonths = Math.max(totalInstallments - currentInstallment, 0);

  return {
    ...debt,
    totalInstallments,
    currentInstallment,
    remainingMonths,
    remainingDebt: remainingMonths * toNumber(debt.monthlyPayment),
    archived: Boolean(debt.archived),
  };
}

export function withJournal(data, action, detail = '') {
  return {
    ...data,
    journal: [
      ...(data.journal ?? []),
      {
        date: new Date().toLocaleString('es-EC'),
        action,
        detail: typeof detail === 'string' ? detail : JSON.stringify(detail),
      },
    ],
  };
}

function fixedAmount(item) {
  return item.useFixedAmount ? toNumber(item.amount) : 0;
}

function isUntouchedPayment(row, item) {
  return row.category === item.description
    && row.concept === item.description
    && row.status === 'Pendiente'
    && !row.date
    && toNumber(row.amount) === fixedAmount(item);
}

function isUntouchedIncome(row, item) {
  return row.source === item.description
    && row.concept === item.description
    && row.type === 'Fijo'
    && (row.status ?? 'Pagado') === 'Pendiente'
    && !row.date
    && toNumber(row.amount) === fixedAmount(item);
}

function syncPaymentsFromBudget(payments, months, previousItems, nextItems) {
  const nextDescriptions = new Set(nextItems.map((item) => item.description));
  const keptPayments = payments.filter((row) => {
    const previousItem = previousItems.find((item) => item.description === row.concept && item.description === row.category);
    if (!previousItem || nextDescriptions.has(previousItem.description)) return true;
    return !isUntouchedPayment(row, previousItem);
  });

  return nextItems.reduce((items, budgetItem) => months.reduce((monthItems, month) => {
    const existingIndex = monthItems.findIndex((row) => row.month === month && row.category === budgetItem.description && row.concept === budgetItem.description);
    if (existingIndex < 0) {
      return [...monthItems, { date: '', month, category: budgetItem.description, concept: budgetItem.description, status: 'Pendiente', amount: fixedAmount(budgetItem) }];
    }

    return monthItems.map((row, rowIndex) => (
      rowIndex === existingIndex && previousItems.some((item) => isUntouchedPayment(row, item))
        ? { ...row, category: budgetItem.description, concept: budgetItem.description, amount: fixedAmount(budgetItem) }
        : row
    ));
  }, items), keptPayments);
}

function syncIncomeFromBudget(income, months, previousItems, nextItems) {
  const nextDescriptions = new Set(nextItems.map((item) => item.description));
  const keptIncome = income.filter((row) => {
    const previousItem = previousItems.find((item) => item.description === row.concept && item.description === row.source);
    if (!previousItem || nextDescriptions.has(previousItem.description)) return true;
    return !isUntouchedIncome(row, previousItem);
  });

  return nextItems.reduce((items, budgetItem) => months.reduce((monthItems, month) => {
    const existingIndex = monthItems.findIndex((row) => row.month === month && row.source === budgetItem.description && row.concept === budgetItem.description);
    if (existingIndex < 0) {
      return [...monthItems, { date: '', month, source: budgetItem.description, concept: budgetItem.description, type: 'Fijo', status: 'Pendiente', amount: fixedAmount(budgetItem) }];
    }

    return monthItems.map((row, rowIndex) => (
      rowIndex === existingIndex && previousItems.some((item) => isUntouchedIncome(row, item))
        ? { ...row, source: budgetItem.description, concept: budgetItem.description, amount: fixedAmount(budgetItem) }
        : row
    ));
  }, items), keptIncome);
}

export function withBudgetRecurring(data, nextFixedBudget) {
  return {
    ...data,
    fixedBudget: nextFixedBudget,
    payments: syncPaymentsFromBudget(data.payments, data.months, data.fixedBudget.expenses, nextFixedBudget.expenses),
    income: syncIncomeFromBudget(data.income, data.months, data.fixedBudget.income, nextFixedBudget.income),
  };
}

export function normalizeDistribution(distribution = []) {
  return suggestedDistribution.map((item) => {
    const saved = distribution.find((row) => row.description === item.description);

    return {
      ...item,
      destination: saved?.destination ?? '',
    };
  });
}

export function buildDistributionRows(baseAmount, distribution = []) {
  const safeBase = Math.max(toNumber(baseAmount), 0);

  return normalizeDistribution(distribution).map((item) => ({
    ...item,
    value: safeBase > 0 ? safeBase * item.percent : 0,
  }));
}
