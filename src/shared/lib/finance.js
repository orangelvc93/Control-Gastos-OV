import { today } from './date';
import { toNumber } from './numbers';

export const suggestedDistribution = [
  { description: 'Comida/Vida', percent: 0.25 },
  { description: 'Ocio', percent: 0.1 },
  { description: 'Gastos Hogar', percent: 0.15 },
  { description: 'Ahorro', percent: 0.5 },
];

export const calendarMonths = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export function createAppId(prefix) {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
  const values = new Uint8Array(6);

  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(values);
    return `${prefix}-${Array.from(values, (value) => alphabet[value % alphabet.length]).join('')}`;
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 8).padEnd(6, '0')}`;
}

function ensureAppId(item, prefix) {
  return item.appId ? item : { ...item, appId: createAppId(prefix) };
}

function recurringInstanceId(type, sourceId, month) {
  return `${type}-${sourceId}-${month}`;
}

export function finalSaving(row) {
  return toNumber(row.initial) + toNumber(row.deposit) - toNumber(row.withdrawal) + toNumber(row.interest);
}

function monthCyclePosition(month, startMonth) {
  const monthIndex = calendarMonths.indexOf(month);
  const startIndex = calendarMonths.indexOf(startMonth);
  if (monthIndex < 0 || startIndex < 0) return calendarMonths.length;
  return (monthIndex - startIndex + calendarMonths.length) % calendarMonths.length;
}

function sortSavingsRows(rows = []) {
  const startMonth = rows[0]?.month;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const leftPosition = monthCyclePosition(left.row.month, startMonth);
      const rightPosition = monthCyclePosition(right.row.month, startMonth);
      if (leftPosition !== rightPosition) return leftPosition - rightPosition;
      return left.index - right.index;
    })
    .map(({ row }) => row);
}

export function recalculateSavingsRows(rows = []) {
  return sortSavingsRows(rows).reduce((nextRows, row, index) => {
    const previousRow = nextRows[index - 1];
    const initial = index === 0 ? toNumber(row.initial) : finalSaving(previousRow);

    return [
      ...nextRows,
      {
        ...row,
        appId: row.appId ?? createAppId('saving-entry'),
        initial,
        deposit: row.deposit === null || row.deposit === '' ? null : toNumber(row.deposit),
        withdrawal: row.withdrawal === null || row.withdrawal === '' ? null : toNumber(row.withdrawal),
        interest: toNumber(row.interest),
      },
    ];
  }, []);
}

export function savingEfficiency(rows, rowIndex, useCurrentInterest = false) {
  const row = rows[rowIndex];
  const nextRow = rows[rowIndex + 1];

  if (!useCurrentInterest && !nextRow) return null;

  const base = toNumber(row.initial) + toNumber(row.deposit) - toNumber(row.withdrawal);
  const interest = useCurrentInterest ? toNumber(row.interest) : toNumber(nextRow.interest);

  return base > 0 ? ((1 + interest / base) ** 12 - 1) * 100 : 0;
}

export function emptyPayment(month) {
  return { appId: createAppId('payment'), date: today(), month, category: '', concept: '', status: 'Pagado', amount: '', generatedBy: 'manual', sourceId: null, manuallyEdited: true };
}

export function emptyIncome(month) {
  return { appId: createAppId('income'), date: today(), month, source: '', concept: '', type: 'Fijo', status: 'Pagado', amount: '', generatedBy: 'manual', sourceId: null, manuallyEdited: true };
}

export function emptyDebt() {
  return {
    appId: createAppId('debt'),
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
  const isLegacyMatch = !row.sourceId && row.month && row.category === item.description && row.concept === item.description;
  return ((row.sourceId === item.appId && row.generatedBy === 'fixed-budget') || (isLegacyMatch && (row.generatedBy ?? 'manual') === 'manual'))
    && !row.manuallyEdited
    && row.status === 'Pendiente'
    && !row.date;
}

function isUntouchedIncome(row, item) {
  const isLegacyMatch = !row.sourceId && row.month && row.source === item.description && row.concept === item.description;
  return ((row.sourceId === item.appId && row.generatedBy === 'fixed-budget') || (isLegacyMatch && (row.generatedBy ?? 'manual') === 'manual'))
    && !row.manuallyEdited
    && row.type === 'Fijo'
    && (row.status ?? 'Pagado') === 'Pendiente'
    && !row.date;
}

function shouldLinkLegacyPayment(row, item) {
  return !row.sourceId
    && row.generatedBy === 'manual'
    && row.category === item.description
    && row.concept === item.description
    && row.status === 'Pendiente'
    && !row.date;
}

function shouldLinkLegacyIncome(row, item) {
  return !row.sourceId
    && row.generatedBy === 'manual'
    && row.source === item.description
    && row.concept === item.description
    && row.type === 'Fijo'
    && (row.status ?? 'Pagado') === 'Pendiente'
    && !row.date;
}

function syncPaymentsFromBudget(payments, months, previousItems, nextItems) {
  const normalizedPreviousItems = previousItems.map((item) => ensureAppId(item, 'budget-expense'));
  const normalizedNextItems = nextItems.map((item) => ensureAppId(item, 'budget-expense'));
  const nextIds = new Set(normalizedNextItems.map((item) => item.appId));
  const keptPayments = payments.filter((row) => {
    const previousItem = normalizedPreviousItems.find((item) => item.appId === row.sourceId || (item.description === row.concept && item.description === row.category));
    if (!previousItem || nextIds.has(previousItem.appId)) return true;
    return !isUntouchedPayment(row, previousItem);
  });

  return normalizedNextItems.reduce((items, budgetItem) => months.reduce((monthItems, month) => {
    const appId = recurringInstanceId('payment', budgetItem.appId, month);
    const existingIndex = monthItems.findIndex((row) => row.appId === appId || row.recurringInstanceId === appId || (row.month === month && row.category === budgetItem.description && row.concept === budgetItem.description));
    if (existingIndex < 0) {
      return [...monthItems, { appId, recurringInstanceId: appId, sourceId: budgetItem.appId, generatedBy: 'fixed-budget', manuallyEdited: false, date: '', month, category: budgetItem.description, concept: budgetItem.description, status: 'Pendiente', amount: fixedAmount(budgetItem) }];
    }

    return monthItems.map((row, rowIndex) => {
      if (rowIndex !== existingIndex) return row;
      const shouldLinkLegacy = shouldLinkLegacyPayment(row, budgetItem);
      const linkedRow = { ...row, appId: shouldLinkLegacy ? appId : row.appId ?? appId, recurringInstanceId: row.recurringInstanceId ?? appId, sourceId: row.sourceId ?? budgetItem.appId, generatedBy: shouldLinkLegacy ? 'fixed-budget' : row.generatedBy ?? 'fixed-budget', manuallyEdited: shouldLinkLegacy ? false : Boolean(row.manuallyEdited) };
      return isUntouchedPayment(linkedRow, budgetItem)
        ? { ...linkedRow, category: budgetItem.description, concept: budgetItem.description, amount: fixedAmount(budgetItem) }
        : linkedRow;
    });
  }, items), keptPayments);
}

function syncIncomeFromBudget(income, months, previousItems, nextItems) {
  const normalizedPreviousItems = previousItems.map((item) => ensureAppId(item, 'budget-income'));
  const normalizedNextItems = nextItems.map((item) => ensureAppId(item, 'budget-income'));
  const nextIds = new Set(normalizedNextItems.map((item) => item.appId));
  const keptIncome = income.filter((row) => {
    const previousItem = normalizedPreviousItems.find((item) => item.appId === row.sourceId || (item.description === row.concept && item.description === row.source));
    if (!previousItem || nextIds.has(previousItem.appId)) return true;
    return !isUntouchedIncome(row, previousItem);
  });

  return normalizedNextItems.reduce((items, budgetItem) => months.reduce((monthItems, month) => {
    const appId = recurringInstanceId('income', budgetItem.appId, month);
    const existingIndex = monthItems.findIndex((row) => row.appId === appId || row.recurringInstanceId === appId || (row.month === month && row.source === budgetItem.description && row.concept === budgetItem.description));
    if (existingIndex < 0) {
      return [...monthItems, { appId, recurringInstanceId: appId, sourceId: budgetItem.appId, generatedBy: 'fixed-budget', manuallyEdited: false, date: '', month, source: budgetItem.description, concept: budgetItem.description, type: 'Fijo', status: 'Pendiente', amount: fixedAmount(budgetItem) }];
    }

    return monthItems.map((row, rowIndex) => {
      if (rowIndex !== existingIndex) return row;
      const shouldLinkLegacy = shouldLinkLegacyIncome(row, budgetItem);
      const linkedRow = { ...row, appId: shouldLinkLegacy ? appId : row.appId ?? appId, recurringInstanceId: row.recurringInstanceId ?? appId, sourceId: row.sourceId ?? budgetItem.appId, generatedBy: shouldLinkLegacy ? 'fixed-budget' : row.generatedBy ?? 'fixed-budget', manuallyEdited: shouldLinkLegacy ? false : Boolean(row.manuallyEdited) };
      return isUntouchedIncome(linkedRow, budgetItem)
        ? { ...linkedRow, source: budgetItem.description, concept: budgetItem.description, amount: fixedAmount(budgetItem) }
        : linkedRow;
    });
  }, items), keptIncome);
}

export function withBudgetRecurring(data, nextFixedBudget) {
  const fixedBudget = {
    ...nextFixedBudget,
    expenses: nextFixedBudget.expenses.map((item) => ensureAppId(item, 'budget-expense')),
    income: nextFixedBudget.income.map((item) => ensureAppId(item, 'budget-income')),
  };

  return {
    ...data,
    fixedBudget,
    payments: syncPaymentsFromBudget(data.payments, data.months, data.fixedBudget.expenses, fixedBudget.expenses),
    income: syncIncomeFromBudget(data.income, data.months, data.fixedBudget.income, fixedBudget.income),
  };
}

export function normalizeDistribution(distribution = []) {
  return suggestedDistribution.map((item) => {
    const saved = distribution.find((row) => row.description === item.description);

    return {
      ...item,
      appId: saved?.appId ?? createAppId('budget-distribution'),
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
