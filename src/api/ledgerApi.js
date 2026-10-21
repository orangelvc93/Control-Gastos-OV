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

const defaultSettings = { telegramChatId: '', telegramEnabled: false, notifyDaysBefore: 2, cardUsageAlertPct: 30 };

function fromSettings(row) {
  if (!row) return defaultSettings;
  return {
    telegramChatId: row.telegram_chat_id ?? '',
    telegramEnabled: row.telegram_enabled,
    notifyDaysBefore: row.notify_days_before,
    cardUsageAlertPct: Number(row.card_usage_alert_pct),
  };
}

// Ver countsForBalance en shared/lib/ledger.js: los movimientos anteriores al saldo inicial no lo cambian.
export async function fetchLedger(supabase) {
  const [accounts, categories, transactions, recurring, notifications, settings, installments, statements] = await Promise.all([
    supabase.from('accounts').select('*').order('sort_order').order('created_at'),
    supabase.from('categories').select('*').order('name'),
    supabase.from('transactions').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('recurring_items').select('*').order('name'),
    supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(60),
    supabase.from('user_settings').select('*').maybeSingle(),
    supabase.from('card_installments').select('*').order('created_at'),
    supabase.from('card_statements').select('*'),
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
  };
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

export async function createAccount(supabase, values) {
  check(await supabase.from('accounts').insert({ ...toAccountRow(values), sort_order: values.sortOrder ?? 0 }));
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
