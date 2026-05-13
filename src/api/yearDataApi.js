import seedData from '../data.json';
import { createAppId } from '../shared/lib/finance';

const tablesToReplace = [
  'payments',
  'income',
  'debts',
  'savings_entries',
  'savings_accounts',
  'fixed_budget_expenses',
  'fixed_budget_income',
  'fixed_budget_distribution',
  'journal',
];

export async function fetchYearsForUser(supabase, userId) {
  const { data, error } = await supabase.from('years').select('year').eq('user_id', userId).order('year');
  if (error) throw error;

  if (data.length) return data.map((row) => String(row.year));

  const currentYear = new Date().getFullYear();
  await createYearForUser(supabase, userId, currentYear);
  return [String(currentYear)];
}

export async function createYearForUser(supabase, userId, year) {
  const normalizedYear = Number(year);
  const { error } = await supabase.from('years').upsert({ user_id: userId, year: normalizedYear }, { onConflict: 'user_id,year' });
  if (error) throw error;
}

export async function loadYearData(supabase, userId, year) {
  const normalizedYear = Number(year);
  await createYearForUser(supabase, userId, normalizedYear);

  const [payments, income, debts, savingsAccounts, savingsEntries, budgetExpenses, budgetIncome, budgetDistribution, journal] = await Promise.all([
    selectYear(supabase, 'payments', userId, normalizedYear),
    selectYear(supabase, 'income', userId, normalizedYear),
    selectYear(supabase, 'debts', userId, normalizedYear),
    selectYear(supabase, 'savings_accounts', userId, normalizedYear),
    selectYear(supabase, 'savings_entries', userId, normalizedYear),
    selectYear(supabase, 'fixed_budget_expenses', userId, normalizedYear),
    selectYear(supabase, 'fixed_budget_income', userId, normalizedYear),
    selectYear(supabase, 'fixed_budget_distribution', userId, normalizedYear),
    selectYear(supabase, 'journal', userId, normalizedYear),
  ]);

  return {
    months: seedData.months,
    payments: payments.map(fromPayment),
    income: income.map(fromIncome),
    debts: debts.map(fromDebt),
    savings: savingsAccounts.map((account) => ({
      appId: account.app_id ?? createAppId('saving-account'),
      name: account.name,
      color: account.color ?? 'purple',
      useCurrentInterestEfficiency: Boolean(account.use_current_interest_efficiency),
      rows: savingsEntries.filter((entry) => entry.account_id === account.id).map(fromSavingEntry),
    })),
    fixedBudget: {
      expenses: budgetExpenses.map(fromBudgetItem),
      income: budgetIncome.map(fromBudgetItem),
      distribution: budgetDistribution.map(fromBudgetDistribution),
    },
    journal: journal.map(fromJournal),
  };
}

export async function saveYearData(supabase, userId, year, data) {
  const normalizedYear = Number(year);
  await createYearForUser(supabase, userId, normalizedYear);

  for (const table of tablesToReplace) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId).eq('year', normalizedYear);
    if (error) throw error;
  }

  await insertRows(supabase, 'payments', data.payments.map((row) => toPayment(row, userId, normalizedYear)));
  await insertRows(supabase, 'income', data.income.map((row) => toIncome(row, userId, normalizedYear)));
  await insertRows(supabase, 'debts', data.debts.map((row) => toDebt(row, userId, normalizedYear)));
  await insertRows(supabase, 'fixed_budget_expenses', data.fixedBudget.expenses.map((row) => toBudgetItem(row, userId, normalizedYear)));
  await insertRows(supabase, 'fixed_budget_income', data.fixedBudget.income.map((row) => toBudgetItem(row, userId, normalizedYear, true)));
  await insertRows(supabase, 'fixed_budget_distribution', data.fixedBudget.distribution.map((row) => toBudgetDistribution(row, userId, normalizedYear)));
  await insertRows(supabase, 'journal', (data.journal ?? []).map((row) => toJournal(row, userId, normalizedYear)));

  for (const account of data.savings ?? []) {
    const { data: insertedAccount, error } = await supabase
      .from('savings_accounts')
      .insert({
        user_id: userId,
        year: normalizedYear,
        app_id: account.appId ?? createAppId('saving-account'),
        name: account.name,
        color: account.color ?? 'purple',
        use_current_interest_efficiency: Boolean(account.useCurrentInterestEfficiency),
      })
      .select('id')
      .single();
    if (error) throw error;

    await insertRows(supabase, 'savings_entries', (account.rows ?? []).map((row) => toSavingEntry(row, userId, normalizedYear, insertedAccount.id)));
  }
}

export async function resetYearData(supabase, userId, year) {
  await saveYearData(supabase, userId, year, seedData);
  return loadYearData(supabase, userId, year);
}

async function selectYear(supabase, table, userId, year) {
  const { data, error } = await supabase.from(table).select('*').eq('user_id', userId).eq('year', year).order('created_at');
  if (error) throw error;
  return data ?? [];
}

async function insertRows(supabase, table, rows) {
  if (!rows.length) return;
  const { error } = await supabase.from(table).insert(rows);
  if (error) throw error;
}

function cleanDate(value) {
  return value || null;
}

function toPayment(row, userId, year) {
  return {
    user_id: userId,
    year,
    app_id: row.appId ?? createAppId('payment'),
    source_id: row.sourceId ?? null,
    generated_by: row.generatedBy ?? 'manual',
    manually_edited: Boolean(row.manuallyEdited),
    date: cleanDate(row.date),
    month: row.month,
    category: row.category,
    concept: row.concept,
    status: row.status,
    amount: Number(row.amount) || 0,
  };
}

function fromPayment(row) {
  return {
    appId: row.app_id ?? createAppId('payment'),
    sourceId: row.source_id ?? null,
    generatedBy: row.generated_by ?? 'manual',
    manuallyEdited: Boolean(row.manually_edited),
    date: row.date,
    month: row.month,
    category: row.category ?? '',
    concept: row.concept ?? '',
    status: row.status ?? 'Pagado',
    amount: Number(row.amount) || 0,
  };
}

function toIncome(row, userId, year) {
  return {
    user_id: userId,
    year,
    app_id: row.appId ?? createAppId('income'),
    source_id: row.sourceId ?? null,
    generated_by: row.generatedBy ?? 'manual',
    manually_edited: Boolean(row.manuallyEdited),
    date: cleanDate(row.date),
    month: row.month,
    source: row.source,
    concept: row.concept,
    type: row.type,
    status: row.status ?? 'Pagado',
    amount: Number(row.amount) || 0,
  };
}

function fromIncome(row) {
  return {
    appId: row.app_id ?? createAppId('income'),
    sourceId: row.source_id ?? null,
    generatedBy: row.generated_by ?? 'manual',
    manuallyEdited: Boolean(row.manually_edited),
    date: row.date,
    month: row.month,
    source: row.source ?? '',
    concept: row.concept ?? '',
    type: row.type ?? 'Fijo',
    status: row.status ?? 'Pagado',
    amount: Number(row.amount) || 0,
  };
}

function toDebt(row, userId, year) {
  return {
    user_id: userId,
    year,
    app_id: row.appId ?? createAppId('debt'),
    loan: row.loan,
    description: row.description,
    total: Number(row.total) || 0,
    monthly_payment: Number(row.monthlyPayment) || 0,
    total_installments: Number(row.totalInstallments) || 0,
    current_installment: Number(row.currentInstallment) || 0,
    interest: row.interest,
    month_value: row.monthValue === '' || row.monthValue === undefined ? null : Number(row.monthValue),
    archived: Boolean(row.archived),
  };
}

function fromDebt(row) {
  return {
    appId: row.app_id ?? createAppId('debt'),
    loan: row.loan ?? '',
    description: row.description ?? '',
    total: Number(row.total) || 0,
    monthlyPayment: Number(row.monthly_payment) || 0,
    totalInstallments: Number(row.total_installments) || 0,
    currentInstallment: Number(row.current_installment) || 0,
    interest: row.interest ?? 'Sin interes',
    monthValue: row.month_value === null ? null : Number(row.month_value),
    archived: Boolean(row.archived),
  };
}

function toSavingEntry(row, userId, year, accountId) {
  return { user_id: userId, year, account_id: accountId, app_id: row.appId ?? createAppId('saving-entry'), description: row.month ?? row.description ?? '', initial: Number(row.initial) || 0, deposit: Number(row.deposit) || 0, withdrawal: Number(row.withdrawal) || 0, interest: Number(row.interest) || 0 };
}

function fromSavingEntry(row) {
  return { appId: row.app_id ?? createAppId('saving-entry'), month: row.description ?? '', initial: Number(row.initial) || 0, deposit: Number(row.deposit) || 0, withdrawal: Number(row.withdrawal) || 0, interest: Number(row.interest) || 0 };
}

function toBudgetItem(row, userId, year, includeInterest = false) {
  const item = { user_id: userId, year, app_id: row.appId ?? createAppId('budget-item'), description: row.description, amount: Number(row.amount) || 0, use_fixed_amount: Boolean(row.useFixedAmount) };
  return includeInterest ? { ...item, is_interest: Boolean(row.isInterest) } : item;
}

function fromBudgetItem(row) {
  return { appId: row.app_id ?? createAppId('budget-item'), description: row.description ?? '', amount: Number(row.amount) || 0, useFixedAmount: Boolean(row.use_fixed_amount), isInterest: Boolean(row.is_interest) };
}

function toBudgetDistribution(row, userId, year) {
  return { user_id: userId, year, app_id: row.appId ?? createAppId('budget-distribution'), description: row.description, percent: Number(row.percent) || 0, destination: row.destination };
}

function fromBudgetDistribution(row) {
  return { appId: row.app_id ?? createAppId('budget-distribution'), description: row.description ?? '', percent: Number(row.percent) || 0, destination: row.destination ?? '' };
}

function toJournal(row, userId, year) {
  return { user_id: userId, year, action: row.action, detail: row.detail ?? '' };
}

function fromJournal(row) {
  return { date: new Date(row.created_at).toLocaleString('es-EC'), action: row.action, detail: row.detail ?? '' };
}
