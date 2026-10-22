import { debtAt } from './cards';
import { sumCents } from './cents';
import { activeTransactions, isDebt, sriCategoryLabels } from './ledger';

// Impuestos (SRI Ecuador): gastos personales deducibles, rebaja estimada, ingresos del año por tipo y deudas al 31/12.
// Ningún valor del SRI se usa fijo: salen de la configuración del año (tax_years), editable por el usuario.
// Los de partida son solo una ayuda y la pantalla pide verificarlos.

const BASKET_LIMITS = { 0: 7, 1: 9, 2: 11, 3: 14, 4: 17, 5: 20 };

// Valores de partida por año (verificar siempre con el SRI).
const STARTING_VALUES = {
  2026: { basicFractionCents: 1220800, basketCents: 82180 },
};

export function taxConfig(taxYears, year) {
  const saved = taxYears.find((item) => item.year === year);
  if (saved) return { ...saved, saved: true };
  // Si no hay valores guardados para ese año, se parte del último año guardado o de los valores de partida.
  const previous = [...taxYears].filter((item) => item.year < year).sort((a, b) => b.year - a.year)[0];
  const starting = STARTING_VALUES[year] ?? {};
  return {
    year,
    basicFractionCents: starting.basicFractionCents ?? previous?.basicFractionCents ?? null,
    basketCents: starting.basketCents ?? previous?.basketCents ?? null,
    rebatePct: previous?.rebatePct ?? 18,
    dependents: previous?.dependents ?? 0,
    catastrophic: previous?.catastrophic ?? false,
    basketLimits: previous?.basketLimits ?? BASKET_LIMITS,
    catastrophicBaskets: previous?.catastrophicBaskets ?? 20,
    interestWithholdingPct: previous?.interestWithholdingPct ?? 2,
    saved: false,
  };
}

// Canastas permitidas: según las cargas familiares (5 o más usan la última fila), o las de enfermedad catastrófica.
export function basketsAllowed(config) {
  if (config.catastrophic) return config.catastrophicBaskets;
  const keys = Object.keys(config.basketLimits).map(Number).sort((a, b) => a - b);
  const key = keys.filter((value) => value <= config.dependents).at(-1) ?? keys[0];
  return Number(config.basketLimits[key] ?? 0);
}

const inYear = (date, year) => date.startsWith(`${year}-`);

// Gastos deducibles del año, con su categoría del SRI y si les falta RUC o número de factura.
export function deductibleExpenses({ transactions, categories }, year) {
  const categoryById = Object.fromEntries(categories.map((category) => [category.id, category]));
  return activeTransactions(transactions)
    .filter((transaction) => transaction.kind === 'gasto' && transaction.deductible && transaction.status === 'confirmado' && inYear(transaction.date, year))
    .map((transaction) => {
      const category = categoryById[transaction.categoryId];
      const sri = category?.sriCategory ?? null;
      return {
        transaction,
        category,
        sri,
        cents: -transaction.cents,
        incomplete: !transaction.invoice?.ruc || !transaction.invoice?.number,
      };
    })
    .sort((a, b) => (a.transaction.date < b.transaction.date ? 1 : -1));
}

// Resumen de gastos personales del año: total por categoría del SRI, tope en canastas y rebaja estimada.
export function personalExpensesSummary(ledger, config) {
  const items = deductibleExpenses(ledger, config.year);
  const byCategory = Object.entries(sriCategoryLabels).map(([key, label]) => ({
    key,
    label,
    cents: sumCents(items.filter((item) => item.sri === key), (item) => item.cents),
    count: items.filter((item) => item.sri === key).length,
  }));
  const withoutCategory = items.filter((item) => !item.sri);
  const total = sumCents(items.filter((item) => item.sri), (item) => item.cents);
  const baskets = basketsAllowed(config);
  const cap = config.basketCents ? baskets * config.basketCents : null;
  const base = cap === null ? total : Math.min(total, cap);
  return {
    items,
    byCategory,
    withoutCategory,
    total,
    baskets,
    cap,
    rebate: Math.round((base * config.rebatePct) / 100),
    incomplete: items.filter((item) => item.incomplete),
  };
}

// Ingresos del año por tipo de la declaración. Los intereses se anotan netos: se reconstruye el bruto
// con el % de retención de la cuenta (o el del año): bruto = neto ÷ (1 − %); retención = bruto − neto.
export function incomeByType({ transactions, categories, accounts }, config) {
  const categoryById = Object.fromEntries(categories.map((category) => [category.id, category]));
  const accountById = Object.fromEntries(accounts.map((account) => [account.id, account]));
  const incomes = activeTransactions(transactions)
    .filter((transaction) => transaction.kind === 'ingreso' && transaction.status === 'confirmado' && inYear(transaction.date, config.year));
  const groups = new Map();
  let withheld = 0;
  for (const transaction of incomes) {
    const type = categoryById[transaction.categoryId]?.taxIncomeType ?? 'sin_tipo';
    let gross = transaction.cents;
    if (type === 'rendimientos_financieros') {
      const source = accountById[transaction.interestAccount ?? transaction.accountId];
      const pct = source?.withholdingPct ?? config.interestWithholdingPct;
      gross = pct ? Math.round(transaction.cents / (1 - pct / 100)) : transaction.cents;
      withheld += gross - transaction.cents;
    }
    const group = groups.get(type) ?? { type, netCents: 0, grossCents: 0, count: 0 };
    group.netCents += transaction.cents;
    group.grossCents += gross;
    group.count += 1;
    groups.set(type, group);
  }
  return { groups: [...groups.values()], withheldCents: withheld };
}

// Deudas: saldo al 31 de diciembre e intereses pagados en el año (gastos en "Intereses y comisiones").
export function debtsAtYearEnd({ accounts, transactions, categories, loans }, year) {
  const interestIds = new Set(categories.filter((category) => category.kind === 'gasto' && category.name === 'Intereses y comisiones').map((category) => category.id));
  const loanAccount = Object.fromEntries(loans.map((loan) => [loan.id, loan.accountId]));
  const yearEnd = `${year}-12-31`;
  const interest = activeTransactions(transactions)
    .filter((transaction) => transaction.kind === 'gasto' && transaction.status === 'confirmado' && interestIds.has(transaction.categoryId) && inYear(transaction.date, year));
  return accounts
    .filter((account) => isDebt(account) && account.openingDate <= yearEnd)
    .map((account) => ({
      account,
      debtCents: Math.max(0, debtAt(account, transactions, yearEnd)),
      interestCents: -sumCents(interest.filter((transaction) => (transaction.loanId ? loanAccount[transaction.loanId] : transaction.accountId) === account.id), (transaction) => transaction.cents),
    }))
    .filter((row) => row.debtCents > 0 || row.interestCents > 0);
}
