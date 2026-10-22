import * as XLSX from 'xlsx';
import { sumCents } from './cents';
import { accountTypeLabels, activeTransactions, isAvailableIncome, kindLabels, monthKey, monthLabel, sriCategoryLabels, taxIncomeLabels } from './ledger';
import { frequencyLabels } from './recurring';
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

// Respaldo completo en Excel: todos los datos de la app en hojas separadas.
// Los movimientos se filtran por el período elegido; cuentas, categorías y configuración van completas.
export function exportBackup(ledger, { from, to, label }) {
  const { accounts, categories, transactions, recurring, installments, loans, goals, statements, taxYears, settings, balances } = ledger;
  const accountName = Object.fromEntries(accounts.map((account) => [account.id, account.name]));
  const categoryById = Object.fromEntries(categories.map((category) => [category.id, category]));
  const inRange = (date) => (!from || date >= from) && (!to || date <= to);
  const items = transactions.filter((transaction) => inRange(transaction.date)).sort((a, b) => (a.date < b.date ? -1 : 1));
  const yesNo = (value) => (value ? 'Sí' : 'No');
  const date = (value) => (value ? shortDate(value.slice(0, 10)) : '');
  const workbook = XLSX.utils.book_new();

  addSheet(workbook, 'Respaldo', [
    { Dato: 'Generado', Valor: new Date().toLocaleString('es-EC') },
    { Dato: 'Período de movimientos', Valor: label },
    { Dato: 'Desde', Valor: from ? shortDate(from) : 'El primero' },
    { Dato: 'Hasta', Valor: to ? shortDate(to) : 'El último' },
    { Dato: 'Movimientos incluidos', Valor: items.length },
    { Dato: 'Nota', Valor: 'Cuentas, categorías, frecuentes, diferidos, créditos, metas y configuración van completos; los movimientos, del período.' },
  ]);

  addSheet(workbook, 'Cuentas', accounts.map((account) => ({
    Nombre: account.name,
    Institución: account.institution,
    Tipo: accountTypeLabels[account.type] ?? account.type,
    'Saldo inicial': dollars(account.openingCents),
    'Desde la fecha': date(account.openingDate),
    'Saldo actual': dollars(balances?.[account.id] ?? null),
    'Es ahorro / inversión': yesNo(account.isSavings),
    'Genera intereses': yesNo(account.earnsInterest),
    'Tasa anual %': account.interestRate,
    'Tipo de tasa': account.rateType ?? '',
    'Retención %': account.withholdingPct,
    Cupo: dollars(account.creditLimitCents),
    'Día de corte': account.statementDay,
    'Día de pago': account.dueDay,
    'Pago mínimo %': account.minPaymentPct,
    'Factores de diferido': account.deferralFactors ? JSON.stringify(account.deferralFactors) : '',
    Archivada: date(account.archivedAt),
  })));

  addSheet(workbook, 'Categorías', categories.map((category) => ({
    Nombre: category.name,
    Tipo: kindLabels[category.kind] ?? category.kind,
    'Categoría SRI': sriCategoryLabels[category.sriCategory] ?? '',
    'Tipo de ingreso SRI': taxIncomeLabels[category.taxIncomeType] ?? '',
    'Ingreso disponible': category.kind === 'ingreso' ? yesNo(category.countsAsIncome) : '',
    Grupo: category.budgetGroup ?? '',
    'Presupuesto mensual': dollars(category.monthlyBudgetCents),
    'Del sistema': yesNo(category.isSystem),
    Archivada: date(category.archivedAt),
  })));

  addSheet(workbook, 'Movimientos', items.map((transaction) => ({
    Fecha: shortDate(transaction.date),
    Cuenta: accountName[transaction.accountId] ?? '',
    Tipo: kindLabels[transaction.kind] ?? transaction.kind,
    Categoría: categoryById[transaction.categoryId]?.name ?? '',
    Descripción: transaction.description,
    Nota: transaction.note,
    Monto: dollars(transaction.cents),
    Estado: transaction.status === 'confirmado' ? 'Confirmado' : 'Pendiente',
    'Transferencia (id)': transaction.transferId ?? '',
    Deducible: yesNo(transaction.deductible),
    'RUC proveedor': transaction.invoice?.ruc ?? '',
    'N.º factura': transaction.invoice?.number ?? '',
    'Base imponible': dollars(transaction.invoice?.baseCents),
    IVA: dollars(transaction.invoice?.ivaCents),
    'Interés del mes': transaction.interestMonth ? monthLabel(monthKey(transaction.interestMonth)) : '',
    'En la papelera': date(transaction.deletedAt),
  })), 'Sin movimientos en este período');

  addSheet(workbook, 'Frecuentes', recurring.map((item) => ({
    Nombre: item.name,
    Tipo: kindLabels[item.kind] ?? item.kind,
    Monto: dollars(item.cents),
    Cuenta: accountName[item.accountId] ?? '',
    Destino: accountName[item.toAccountId] ?? '',
    Categoría: categoryById[item.categoryId]?.name ?? '',
    Frecuencia: frequencyLabels[item.frequency] ?? item.frequency,
    Desde: date(item.startDate),
    Hasta: date(item.endDate),
    'Monto fijo': yesNo(item.fixedAmount),
    Nota: item.note,
    Pausado: date(item.archivedAt),
  })));

  addSheet(workbook, 'Diferidos', installments.map((plan) => ({
    Tarjeta: accountName[plan.accountId] ?? '',
    Descripción: plan.description,
    'Monto original': dollars(plan.principalCents),
    Meses: plan.months,
    'Con intereses': yesNo(plan.withInterest),
    'Primer corte': date(plan.firstCut),
    'Ya lo tenías al empezar': yesNo(plan.inOpening),
    'Precancelado en el corte': date(plan.prepaidCut),
    'Cuotas precanceladas': plan.prepaidCount ?? '',
    Eliminado: date(plan.archivedAt),
  })));

  addSheet(workbook, 'Créditos', loans.map((loan) => ({
    Cuenta: accountName[loan.accountId] ?? '',
    Tipo: loan.kind,
    Monto: dollars(loan.principalCents),
    'Tasa anual %': loan.annualRate,
    'Tipo de tasa': loan.rateType,
    Plazo: loan.termMonths,
    Sistema: loan.system,
    'Primer pago': date(loan.firstPaymentDate),
    'Día de pago': loan.paymentDay,
    'Cuotas pagadas antes': loan.paidBefore,
    Cuota: dollars(loan.paymentAmountCents),
    'Comisión mensual': dollars(loan.monthlyFeeCents),
    'Se paga desde': accountName[loan.payAccountId] ?? '',
    Archivado: date(loan.archivedAt),
  })));

  addSheet(workbook, 'Estados de cuenta', statements.map((statement) => ({
    Tarjeta: accountName[statement.accountId] ?? '',
    Corte: date(statement.cutDate),
    'Pago mínimo del banco': dollars(statement.minPaymentCents),
    'Total del banco': dollars(statement.bankTotalCents),
  })));

  addSheet(workbook, 'Metas', goals.map((goal) => ({
    Nombre: goal.name,
    Objetivo: dollars(goal.targetCents),
    'Fecha límite': date(goal.deadline),
    Cuenta: accountName[goal.accountId] ?? '',
    'Ahorrado a mano': dollars(goal.manualSavedCents),
    Inicio: date(goal.startDate),
    Archivada: date(goal.archivedAt),
  })));

  addSheet(workbook, 'Valores del SRI', taxYears.map((year) => ({
    Año: year.year,
    'Fracción básica': dollars(year.basicFractionCents),
    'Canasta básica': dollars(year.basketCents),
    'Rebaja %': year.rebatePct,
    'Cargas familiares': year.dependents,
    'Enfermedad catastrófica': yesNo(year.catastrophic),
    'Canastas por cargas': JSON.stringify(year.basketLimits),
    'Retención intereses %': year.interestWithholdingPct,
  })));

  addSheet(workbook, 'Ajustes', settings ? [
    { Ajuste: 'Ingreso mensual anotado', Valor: dollars(settings.monthlyIncomeCents) },
    { Ajuste: 'Plan 50/30/20', Valor: `${settings.planNeedsPct} / ${settings.planWantsPct} / ${settings.planSavingsPct}` },
    { Ajuste: 'Fondo de emergencia', Valor: accountName[settings.emergencyAccountId] ?? '' },
    { Ajuste: 'Avisar días antes', Valor: settings.notifyDaysBefore },
    { Ajuste: 'Aviso de uso de tarjeta %', Valor: settings.cardUsageAlertPct },
  ] : []);

  const stamp = from || to ? `${from ?? 'inicio'}_${to ?? 'hoy'}` : 'todo';
  download(workbook, `respaldo-control-gastos_${stamp}.xlsx`);
}

