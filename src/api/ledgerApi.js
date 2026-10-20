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
    archivedAt: row.archived_at,
  };
}

export async function fetchLedger(supabase) {
  const [accounts, categories, transactions, recurring] = await Promise.all([
    supabase.from('accounts').select('*').order('sort_order').order('created_at'),
    supabase.from('categories').select('*').order('name'),
    supabase.from('transactions').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('recurring_items').select('*').order('name'),
  ]);

  return {
    accounts: check(accounts).map(fromAccount),
    categories: check(categories).map(fromCategory),
    transactions: check(transactions).map(fromTransaction),
    recurring: check(recurring).map(fromRecurring),
  };
}

// Movimientos ----------------------------------------------------------------

export async function createTransaction(supabase, values) {
  check(await supabase.from('transactions').insert({
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
  }));
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
