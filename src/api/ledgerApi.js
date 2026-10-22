import { centsToDb, toCents } from '../shared/lib/cents';

// Acceso a las tablas de la fase 1 (accounts, categories, transactions).
// Cada operación toca solo las filas afectadas; los montos viajan como texto "123.45" y en la app se usan en centavos.

function check({ data, error }) {
  if (error) throw error;
  return data;
}

function fromAccount(row) {
  return {
    id: row.id,
    name: row.name,
    institution: row.institution ?? '',
    type: row.type,
    openingCents: toCents(row.opening_balance),
    openingDate: row.opening_date,
    interestRate: row.interest_rate === null ? null : Number(row.interest_rate),
    rateType: row.rate_type,
    dayBasis: row.day_basis,
    capitalizes: row.capitalizes,
    interestAccountId: row.interest_account_id,
    creditLimitCents: row.credit_limit === null ? null : toCents(row.credit_limit),
    statementDay: row.statement_day,
    dueDay: row.due_day,
    isSavings: row.is_savings,
    minPaymentPct: Number(row.min_payment_pct ?? 10),
    deferralFactors: row.deferral_factors ?? {},
    earnsInterest: Boolean(row.earns_interest),
    withholdingPct: row.withholding_pct === null || row.withholding_pct === undefined ? null : Number(row.withholding_pct),
    color: row.color,
    sortOrder: row.sort_order,
    archivedAt: row.archived_at,
  };
}

function toAccountRow(values) {
  return {
    name: values.name.trim(),
    institution: values.institution.trim(),
    type: values.type,
    opening_balance: centsToDb(values.openingCents),
    opening_date: values.openingDate,
    is_savings: Boolean(values.isSavings),
    credit_limit: values.creditLimitCents === null ? null : centsToDb(values.creditLimitCents),
    statement_day: values.statementDay || null,
    due_day: values.dueDay || null,
    interest_rate: values.interestRate === null || values.interestRate === '' ? null : Number(values.interestRate),
    rate_type: values.rateType || null,
    day_basis: values.dayBasis ? Number(values.dayBasis) : null,
    capitalizes: values.capitalizes ?? true,
    min_payment_pct: values.minPaymentPct ?? 10,
    deferral_factors: values.deferralFactors ?? {},
    earns_interest: Boolean(values.earnsInterest),
    withholding_pct: values.withholdingPct ?? null,
    interest_account_id: values.interestAccountId || null,
    color: values.color ?? 'purple',
  };
}

function fromCategory(row) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    sriCategory: row.sri_category,
    taxIncomeType: row.tax_income_type,
    isSystem: row.is_system,
    budgetGroup: row.budget_group,
    monthlyBudgetCents: row.monthly_budget === null || row.monthly_budget === undefined ? null : toCents(row.monthly_budget),
    archivedAt: row.archived_at,
  };
}

function fromTransaction(row) {
  return {
    id: row.id,
    accountId: row.account_id,
    date: row.date,
    cents: toCents(row.amount),
    kind: row.kind,
    categoryId: row.category_id,
    transferId: row.transfer_id,
    status: row.status,
    description: row.description ?? '',
    note: row.note ?? '',
    recurringId: row.recurring_id,
    occurrenceDate: row.occurrence_date,
    installmentId: row.installment_id,
    loanId: row.loan_id,
    loanNo: row.loan_no,
    interestMonth: row.interest_month,
    interestAccount: row.interest_account,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

function fromRecurring(row) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    cents: toCents(row.amount),
    accountId: row.account_id,
    toAccountId: row.to_account_id,
    categoryId: row.category_id,
    frequency: row.frequency,
    startDate: row.start_date,
    endDate: row.end_date,
    note: row.note ?? '',
    fixedAmount: row.fixed_amount,
    archivedAt: row.archived_at,
  };
}

function fromInstallment(row) {
  return {
    id: row.id,
    accountId: row.account_id,
    transactionId: row.transaction_id,
    description: row.description ?? '',
    principalCents: toCents(row.principal),
    months: row.months,
    withInterest: row.with_interest,
    firstCut: row.first_cut,
    inOpening: row.in_opening,
    archivedAt: row.archived_at,
  };
}

function fromLoan(row) {
  return {
    id: row.id,
    accountId: row.account_id,
    kind: row.kind,
    principalCents: toCents(row.principal),
    annualRate: Number(row.annual_rate),
    rateType: row.rate_type,
    termMonths: row.term_months,
    system: row.system,
    firstPaymentDate: row.first_payment_date,
    paymentDay: row.payment_day,
    paidBefore: row.paid_before,
    paymentAmountCents: toCents(row.payment_amount),
    monthlyFeeCents: toCents(row.monthly_fee),
    payAccountId: row.pay_account_id,
    autoConfirm: row.auto_confirm,
    archivedAt: row.archived_at,
  };
}

function toLoanRow(values) {
  return {
    account_id: values.accountId,
    kind: values.kind,
    principal: centsToDb(values.principalCents),
    annual_rate: values.annualRate,
    rate_type: values.rateType,
    term_months: values.termMonths,
    system: values.system,
    first_payment_date: values.firstPaymentDate,
    payment_day: values.paymentDay,
    paid_before: values.paidBefore,
    payment_amount: centsToDb(values.paymentAmountCents),
    monthly_fee: centsToDb(values.monthlyFeeCents),
    pay_account_id: values.payAccountId,
    auto_confirm: values.autoConfirm,
  };
}

export async function createLoan(supabase, values) {
  check(await supabase.from('loans').insert(toLoanRow(values)));
}

export async function updateLoan(supabase, id, values) {
  check(await supabase.from('loans').update(toLoanRow(values)).eq('id', id));
}

export async function setLoanPayment(supabase, id, paymentAmountCents) {
  check(await supabase.from('loans').update({ payment_amount: centsToDb(paymentAmountCents) }).eq('id', id));
}

function fromStatement(row) {
  return {
    id: row.id,
    accountId: row.account_id,
    cutDate: row.cut_date,
    minPaymentCents: row.min_payment === null ? null : toCents(row.min_payment),
    bankTotalCents: row.bank_total === null ? null : toCents(row.bank_total),
  };
}

function fromNotification(row) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    link: row.link,
    createdAt: row.created_at,
    readAt: row.read_at,
    sentTelegram: Boolean(row.telegram_sent_at),
  };
}

const defaultSettings = { telegramChatId: '', telegramEnabled: false, notifyDaysBefore: 2, cardUsageAlertPct: 30, monthlyIncomeCents: null,
  planNeedsPct: 50, planWantsPct: 30, planSavingsPct: 20, emergencyAccountId: null };

function fromSettings(row) {
  if (!row) return defaultSettings;
  return {
    telegramChatId: row.telegram_chat_id ?? '',
    telegramEnabled: row.telegram_enabled,
    notifyDaysBefore: row.notify_days_before,
    cardUsageAlertPct: Number(row.card_usage_alert_pct),
    monthlyIncomeCents: row.monthly_income === null || row.monthly_income === undefined ? null : toCents(row.monthly_income),
    planNeedsPct: Number(row.plan_needs_pct ?? 50),
    planWantsPct: Number(row.plan_wants_pct ?? 30),
    planSavingsPct: Number(row.plan_savings_pct ?? 20),
    emergencyAccountId: row.emergency_account_id ?? null,
  };
}

// Ver countsForBalance en shared/lib/ledger.js: los movimientos anteriores al saldo inicial no lo cambian.
export async function fetchLedger(supabase) {
  const [accounts, categories, transactions, recurring, notifications, settings, installments, statements, loans, goals] = await Promise.all([
    supabase.from('accounts').select('*').order('sort_order').order('created_at'),
    supabase.from('categories').select('*').order('name'),
    supabase.from('transactions').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('recurring_items').select('*').order('name'),
    supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(60),
    supabase.from('user_settings').select('*').maybeSingle(),
    supabase.from('card_installments').select('*').order('created_at'),
    supabase.from('card_statements').select('*'),
    supabase.from('loans').select('*').order('created_at'),
    supabase.from('goals').select('*').order('created_at'),
  ]);

  return {
    accounts: check(accounts).map(fromAccount),
    categories: check(categories).map(fromCategory),
    transactions: check(transactions).map(fromTransaction),
    recurring: check(recurring).map(fromRecurring),
    notifications: check(notifications).map(fromNotification),
    settings: fromSettings(check(settings)),
    installments: check(installments).map(fromInstallment),
    statements: check(statements).map(fromStatement),
    loans: check(loans).map(fromLoan),
    goals: check(goals).map(fromGoal),
  };
}

// Ahorro: presupuesto, intereses anotados y metas -----------------------------------

function fromGoal(row) {
  return {
    id: row.id,
    name: row.name,
    targetCents: toCents(row.target),
    deadline: row.deadline,
    accountId: row.account_id,
    manualSavedCents: toCents(row.manual_saved),
    startDate: row.start_date,
    archivedAt: row.archived_at,
  };
}

function toGoalRow(values) {
  return {
    name: values.name.trim(),
    target: centsToDb(values.targetCents),
    deadline: values.deadline || null,
    account_id: values.accountId || null,
    manual_saved: centsToDb(values.manualSavedCents ?? 0),
    start_date: values.startDate,
  };
}

export async function createGoal(supabase, values) {
  check(await supabase.from('goals').insert(toGoalRow(values)));
}

export async function updateGoal(supabase, id, values) {
  check(await supabase.from('goals').update(toGoalRow(values)).eq('id', id));
}

export async function setGoalArchived(supabase, id, archived) {
  check(await supabase.from('goals').update({ archived_at: archived ? new Date().toISOString() : null }).eq('id', id));
}

export async function updateCategoryBudget(supabase, id, { budgetGroup, monthlyBudgetCents }) {
  check(await supabase.from('categories').update({
    budget_group: budgetGroup || null,
    monthly_budget: monthlyBudgetCents ? centsToDb(monthlyBudgetCents) : null,
  }).eq('id', id));
}

export async function savePlanSettings(supabase, userId, values) {
  check(await supabase.from('user_settings').upsert({
    user_id: userId,
    plan_needs_pct: values.planNeedsPct,
    plan_wants_pct: values.planWantsPct,
    plan_savings_pct: values.planSavingsPct,
    emergency_account_id: values.emergencyAccountId || null,
  }));
}

// Categoría de los intereses ganados (cuenta para el SRI como rendimientos financieros).
export async function ensureInterestIncomeCategory(supabase, categories) {
  const found = categories.find((category) => category.kind === 'ingreso' && category.name === 'Rendimientos financieros');
  if (found) return found.id;
  return check(await supabase.from('categories').insert({
    name: 'Rendimientos financieros', kind: 'ingreso', tax_income_type: 'rendimientos_financieros', is_system: true,
  }).select('id').single()).id;
}

// Tarjetas: diferidos y estados de cuenta -----------------------------------------

function toInstallmentRow(values) {
  return {
    account_id: values.accountId,
    transaction_id: values.transactionId ?? null,
    description: values.description.trim(),
    principal: centsToDb(values.principalCents),
    months: values.months,
    with_interest: Boolean(values.withInterest),
    first_cut: values.firstCut,
    in_opening: Boolean(values.inOpening),
  };
}

export async function createInstallment(supabase, values) {
  check(await supabase.from('card_installments').insert(toInstallmentRow(values)));
}

export async function updateInstallment(supabase, id, values) {
  check(await supabase.from('card_installments').update(toInstallmentRow(values)).eq('id', id));
}

export async function setInstallmentArchived(supabase, id, archived) {
  check(await supabase.from('card_installments').update({ archived_at: archived ? new Date().toISOString() : null }).eq('id', id));
}

// Lo anotado del estado del banco (mínimo y total); vacío = se estima.
export async function saveStatement(supabase, values) {
  check(await supabase.from('card_statements').upsert({
    account_id: values.accountId,
    cut_date: values.cutDate,
    min_payment: values.minPaymentCents === null ? null : centsToDb(values.minPaymentCents),
    bank_total: values.bankTotalCents === null ? null : centsToDb(values.bankTotalCents),
  }, { onConflict: 'account_id,cut_date' }));
}

// Avisos y automatización --------------------------------------------------------

export async function markNotificationsRead(supabase, ids) {
  if (!ids.length) return;
  check(await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids));
}

// Registra los frecuentes que tocan hoy y genera avisos, sin esperar a la tarea de las 06:00.
export async function runMyDailyJobs(supabase) {
  return check(await supabase.rpc('run_my_daily_jobs'));
}

export async function sendTelegramTest(supabase) {
  return check(await supabase.rpc('telegram_send_test'));
}

export async function saveSettings(supabase, userId, values) {
  check(await supabase.from('user_settings').upsert({
    user_id: userId,
    telegram_chat_id: values.telegramChatId.trim() || null,
    telegram_enabled: Boolean(values.telegramEnabled && values.telegramChatId.trim()),
    notify_days_before: Number(values.notifyDaysBefore),
    card_usage_alert_pct: Number(values.cardUsageAlertPct),
  }));
}

// Ingreso mensual para el % de endeudamiento (null = usar el promedio de los últimos meses).
export async function saveMonthlyIncome(supabase, userId, cents) {
  check(await supabase.from('user_settings').upsert({ user_id: userId, monthly_income: cents === null ? null : centsToDb(cents) }));
}

// Movimientos ----------------------------------------------------------------

// Devuelve el id (lo necesita el diferido de una compra con tarjeta).
export async function createTransaction(supabase, values) {
  return check(await supabase.from('transactions').insert({
    account_id: values.accountId,
    date: values.date,
    amount: centsToDb(values.cents),
    kind: values.kind,
    category_id: values.categoryId ?? null,
    status: values.status,
    description: values.description.trim(),
    note: values.note.trim(),
    recurring_id: values.recurringId ?? null,
    occurrence_date: values.occurrenceDate ?? null,
    interest_month: values.interestMonth ?? null,
    interest_account: values.interestAccount ?? null,
  }).select('id').single()).id;
}

export async function updateTransaction(supabase, id, values) {
  check(await supabase.from('transactions').update({
    account_id: values.accountId,
    date: values.date,
    amount: centsToDb(values.cents),
    kind: values.kind,
    category_id: values.categoryId ?? null,
    status: values.status,
    description: values.description.trim(),
    note: values.note.trim(),
  }).eq('id', id));
}

export async function createTransfer(supabase, values) {
  check(await supabase.rpc('create_transfer', {
    p_from: values.fromAccountId,
    p_to: values.toAccountId,
    p_amount: centsToDb(values.cents),
    p_date: values.date,
    p_description: values.description.trim(),
    p_note: values.note.trim(),
    p_status: values.status,
    p_recurring_id: values.recurringId ?? null,
    p_occurrence_date: values.occurrenceDate ?? null,
  }));
}

export async function updateTransfer(supabase, transferId, values) {
  check(await supabase.rpc('update_transfer', {
    p_transfer: transferId,
    p_from: values.fromAccountId,
    p_to: values.toAccountId,
    p_amount: centsToDb(values.cents),
    p_date: values.date,
    p_description: values.description.trim(),
    p_note: values.note.trim(),
    p_status: values.status,
  }));
}

// Una transferencia son 2 filas: se borran, restauran o eliminan juntas.
function matchTransaction(query, transaction) {
  return transaction.transferId ? query.eq('transfer_id', transaction.transferId) : query.eq('id', transaction.id);
}

export async function moveToTrash(supabase, transaction) {
  check(await matchTransaction(supabase.from('transactions').update({ deleted_at: new Date().toISOString() }), transaction));
}

export async function restoreFromTrash(supabase, transaction) {
  check(await matchTransaction(supabase.from('transactions').update({ deleted_at: null }), transaction));
}

export async function deleteForever(supabase, transaction) {
  check(await matchTransaction(supabase.from('transactions').delete(), transaction));
}

// Cuentas --------------------------------------------------------------------

// Devuelve el id (un crédito crea primero su cuenta y luego su ficha).
export async function createAccount(supabase, values) {
  return check(await supabase.from('accounts').insert({ ...toAccountRow(values), sort_order: values.sortOrder ?? 0 }).select('id').single()).id;
}

export async function updateAccount(supabase, id, values) {
  check(await supabase.from('accounts').update(toAccountRow(values)).eq('id', id));
}

export async function setAccountArchived(supabase, id, archived) {
  check(await supabase.from('accounts').update({ archived_at: archived ? new Date().toISOString() : null }).eq('id', id));
}

// Frecuentes -----------------------------------------------------------------

function toRecurringRow(values) {
  const transfer = values.kind === 'transferencia';
  return {
    name: values.name.trim(),
    kind: values.kind,
    amount: centsToDb(values.cents),
    account_id: values.accountId,
    to_account_id: transfer ? values.toAccountId : null,
    category_id: transfer ? null : values.categoryId,
    frequency: values.frequency,
    start_date: values.startDate,
    end_date: values.endDate || null,
    note: values.note.trim(),
    fixed_amount: values.fixedAmount ?? true,
  };
}

export async function createRecurring(supabase, values) {
  check(await supabase.from('recurring_items').insert(toRecurringRow(values)));
}

export async function updateRecurring(supabase, id, values) {
  check(await supabase.from('recurring_items').update(toRecurringRow(values)).eq('id', id));
}

export async function setRecurringArchived(supabase, id, archived) {
  check(await supabase.from('recurring_items').update({ archived_at: archived ? new Date().toISOString() : null }).eq('id', id));
}

// Categorías -----------------------------------------------------------------

export async function createCategory(supabase, values) {
  check(await supabase.from('categories').insert({
    name: values.name.trim(),
    kind: values.kind,
    sri_category: values.sriCategory || null,
  }));
}

export async function updateCategory(supabase, id, values) {
  check(await supabase.from('categories').update({
    name: values.name.trim(),
    sri_category: values.sriCategory || null,
  }).eq('id', id));
}

export async function setCategoryArchived(supabase, id, archived) {
  check(await supabase.from('categories').update({ archived_at: archived ? new Date().toISOString() : null }).eq('id', id));
}
