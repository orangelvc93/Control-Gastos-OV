import * as XLSX from 'xlsx';
import { sumCents } from './cents';
import { activeTransactions, isAvailableIncome, kindLabels, monthKey, monthLabel, sriCategoryLabels, taxIncomeLabels } from './ledger';
import { debtsAtYearEnd, incomeByType, personalExpensesSummary } from './taxes';

// Reportes en Excel. Se carga solo al exportar (xlsx pesa).

const dollars = (cents) => (cents === null || cents === undefined ? null : cents / 100);
const shortDate = (date) => date.split('-').reverse().join('/');

function addSheet(workbook, name, rows, empty = 'Sin datos en este período') {
  const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Nota: empty }]);
  XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
}

function download(workbook, fileName) {
  XLSX.writeFile(workbook, fileName);
}

// Reporte de un rango de fechas: movimientos, resumen mensual, gastos por categoría e intereses ganados.
export function exportRangeReport({ accounts, categories, transactions }, from, to) {
  const accountById = Object.fromEntries(accounts.map((account) => [account.id, account]));
  const categoryById = Object.fromEntries(categories.map((category) => [category.id, category]));
  const items = activeTransactions(transactions)
    .filter((transaction) => transaction.date >= from && transaction.date <= to)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const confirmed = items.filter((transaction) => transaction.status === 'confirmado');
  const workbook = XLSX.utils.book_new();

  addSheet(workbook, 'Movimientos', items.map((transaction) => ({
    Fecha: shortDate(transaction.date),
    Cuenta: accountById[transaction.accountId]?.name ?? '',
    Tipo: kindLabels[transaction.kind] ?? transaction.kind,
    Categoría: categoryById[transaction.categoryId]?.name ?? '',
    Descripción: transaction.description,
    Monto: dollars(transaction.cents),
    Estado: transaction.status === 'confirmado' ? 'Confirmado' : 'Pendiente',
    Deducible: transaction.deductible ? 'Sí' : '',
  })));

  const months = [...new Set(confirmed.map((transaction) => monthKey(transaction.date)))].sort();
  addSheet(workbook, 'Resumen mensual', months.map((key) => {
    const month = confirmed.filter((transaction) => monthKey(transaction.date) === key);
    const income = sumCents(month.filter(isAvailableIncome), (transaction) => transaction.cents);
    const expenses = -sumCents(month.filter((transaction) => transaction.kind === 'gasto'), (transaction) => transaction.cents);
    return { Mes: monthLabel(key), Ingresos: dollars(income), Gastos: dollars(expenses), Diferencia: dollars(income - expenses) };
  }));

  const byCategory = new Map();
  for (const transaction of confirmed.filter((item) => item.kind === 'gasto')) {
    const name = categoryById[transaction.categoryId]?.name ?? 'Sin categoría';
    byCategory.set(name, (byCategory.get(name) ?? 0) - transaction.cents);
  }
  const expensesTotal = sumCents([...byCategory.values()]);
  addSheet(workbook, 'Gastos por categoría', [...byCategory.entries()].sort((a, b) => b[1] - a[1]).map(([name, cents]) => ({
    Categoría: name, Total: dollars(cents), '% del gasto': expensesTotal ? Math.round((cents / expensesTotal) * 1000) / 10 : 0,
  })));

  addSheet(workbook, 'Intereses ganados', confirmed.filter((transaction) => transaction.interestMonth).map((transaction) => ({
    Mes: monthLabel(monthKey(transaction.interestMonth)),
    Cuenta: accountById[transaction.interestAccount]?.name ?? '',
    Interés: dollars(transaction.cents),
  })));

  download(workbook, `control-gastos_${from}_${to}.xlsx`);
}

// Exportación anual para el SRI: gastos personales con el detalle de cada factura, ingresos por tipo,
// retenciones y deudas al 31 de diciembre. Lleva la nota de verificar los valores con la normativa vigente.
export function exportSriReport(ledger, config) {
  const summary = personalExpensesSummary(ledger, config);
  const income = incomeByType(ledger, config);
  const debts = debtsAtYearEnd(ledger, config.year);
  const workbook = XLSX.utils.book_new();

  addSheet(workbook, 'Resumen', [
    { Concepto: 'Año fiscal', Valor: config.year },
    ...summary.byCategory.map((row) => ({ Concepto: `Gastos personales · ${row.label}`, Valor: dollars(row.cents) })),
    { Concepto: 'Total gastos personales', Valor: dollars(summary.total) },
    { Concepto: `Tope (${summary.baskets} canastas × ${dollars(config.basketCents) ?? '—'})`, Valor: dollars(summary.cap) },
    { Concepto: `Rebaja estimada (${config.rebatePct} % del menor valor)`, Valor: dollars(summary.rebate) },
    { Concepto: 'Retención estimada en intereses', Valor: dollars(income.withheldCents) },
    { Concepto: 'NOTA', Valor: 'Los límites, porcentajes y valores del SRI cambian cada año: verifícalos con la normativa vigente antes de declarar.' },
  ]);

  addSheet(workbook, 'Gastos personales', summary.items.filter((item) => item.sri).map((item) => ({
    Fecha: shortDate(item.transaction.date),
    'Categoría SRI': sriCategoryLabels[item.sri],
    'RUC proveedor': item.transaction.invoice.ruc,
    'N.º factura': item.transaction.invoice.number,
    'Base imponible': dollars(item.transaction.invoice.baseCents),
    IVA: dollars(item.transaction.invoice.ivaCents),
    Total: dollars(item.cents),
    Descripción: item.transaction.description,
  })), 'Sin gastos deducibles en el año');

  addSheet(workbook, 'Ingresos por tipo', income.groups.map((group) => ({
    Tipo: taxIncomeLabels[group.type] ?? 'Sin tipo asignado (revisa la categoría)',
    'Recibido (neto)': dollars(group.netCents),
    Bruto: dollars(group.grossCents),
    Movimientos: group.count,
  })), 'Sin ingresos en el año');

  addSheet(workbook, 'Deudas al 31-12', debts.map((row) => ({
    Cuenta: row.account.name,
    'Saldo al 31/12': dollars(row.debtCents),
    'Intereses pagados en el año': dollars(row.interestCents),
  })), 'Sin deudas en el año');

  download(workbook, `sri_${config.year}.xlsx`);
}

