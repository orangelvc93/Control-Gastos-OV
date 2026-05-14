import * as XLSX from 'xlsx';
import { formatExcelDate } from './date';
import { finalSaving, recalculateSavingsRows, savingEfficiency } from './finance';
import { toNumber } from './numbers';

function appendSheet(workbook, name, rows) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, name.slice(0, 31));
}

function distributionExportRows(rows) {
  return rows.map((row) => ({
    Categoria: row.description,
    Porcentaje: row.percent,
    Valor: row.value,
    Destino: row.destination,
  }));
}

export function exportFinanceBook({ activeYear, data, debtRows, distributionWithInterest, distributionWithoutInterest, monthlySummary }) {
  const workbook = XLSX.utils.book_new();

  appendSheet(workbook, 'Resumen mensual', monthlySummary.map((row) => ({
    Mes: row.month,
    Pagos: row.payments,
    Ganancias: row.income,
    Balance: row.balance,
  })));

  appendSheet(workbook, 'Pagos', data.payments.filter((row) => row.status === 'Pagado').map((row) => ({
    Fecha: formatExcelDate(row.date),
    Mes: row.month,
    Categoria: row.category,
    Concepto: row.concept,
    Estado: row.status,
    Monto: toNumber(row.amount),
  })));

  appendSheet(workbook, 'Ganancias', data.income.filter((row) => row.status === 'Pagado').map((row) => ({
    Fecha: formatExcelDate(row.date),
    Mes: row.month,
    Origen: row.source,
    Concepto: row.concept,
    Tipo: row.type,
    Estado: row.status ?? 'Pagado',
    Monto: toNumber(row.amount),
  })));

  appendSheet(workbook, 'Deudas', debtRows.map((debt) => ({
    Prestamo: debt.loan,
    Descripcion: debt.description,
    Total: toNumber(debt.total),
    'Cuota mensual': toNumber(debt.monthlyPayment),
    'Cuotas totales': toNumber(debt.totalInstallments),
    'Cuotas pagadas': toNumber(debt.currentInstallment),
    'Cuotas faltantes': toNumber(debt.remainingMonths),
    'Deuda restante': toNumber(debt.remainingDebt),
    Interes: debt.interest,
    'Valor del mes': debt.monthValue === null ? '' : toNumber(debt.monthValue),
    Archivada: debt.archived ? 'Si' : 'No',
  })));

  appendSheet(workbook, 'Ahorros', data.savings.flatMap((account) => {
    const rows = recalculateSavingsRows(account.rows);

    return rows.map((row, rowIndex) => ({
      Cuenta: account.name,
      Orden: row.position,
      Mes: row.month,
      'Saldo inicial': toNumber(row.initial),
      Aporte: row.deposit === null ? '' : toNumber(row.deposit),
      Interes: toNumber(row.interest),
      'Saldo final': finalSaving(row),
      Eficiencia: savingEfficiency(rows, rowIndex, Boolean(account.useCurrentInterestEfficiency)) ?? 'Pendiente',
    }));
  }));

  appendSheet(workbook, 'Gastos fijos', data.fixedBudget.expenses.map((row) => ({
    Descripcion: row.description,
    Valor: toNumber(row.amount),
  })));

  appendSheet(workbook, 'Ganancias fijas', data.fixedBudget.income.map((row) => ({
    Descripcion: row.description,
    Valor: toNumber(row.amount),
  })));

  appendSheet(workbook, 'Distribucion con interes', distributionExportRows(distributionWithInterest));
  appendSheet(workbook, 'Distribucion real', distributionExportRows(distributionWithoutInterest));

  XLSX.writeFile(workbook, `control-gastos-${activeYear}.xlsx`);
}
