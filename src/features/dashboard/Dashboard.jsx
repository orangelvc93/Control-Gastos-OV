import { money } from '../../shared/lib/money';
import { Card } from '../../shared/ui/Card';
import { Kpi } from '../../shared/ui/Kpi';
import { SectionTitle } from '../../shared/ui/SectionTitle';
import { Select } from '../../shared/ui/FormControls';
import { Table } from '../../shared/ui/Table';

export function Dashboard({
  debts,
  monthlySummary,
  selectedMonth,
  selectedSummary,
  setSelectedMonth,
  totalDebtPayment,
  totalRemainingDebt,
}) {
  const maxValue = Math.max(...monthlySummary.map((item) => Math.max(item.payments, item.income)), 1);

  return (
    <section className="grid-layout dashboard-grid">
      <Card className="span-2 featured-card">
        <SectionTitle
          actions={(
            <Select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
              {monthlySummary.map((item) => <option key={item.month}>{item.month}</option>)}
            </Select>
          )}
        >
          <div><p className="overline">Resumen anual</p><h2>Dashboard mensual</h2></div>
        </SectionTitle>
        <div className="kpi-grid">
          <Kpi title="Pagos" value={money.format(selectedSummary.payments)} tone="danger" />
          <Kpi title="Ganancias" value={money.format(selectedSummary.income)} tone="success" />
          <Kpi title="Total" value={money.format(selectedSummary.balance)} tone={selectedSummary.balance >= 0 ? 'success' : 'danger'} />
        </div>
        <div className="bar-chart">
          {monthlySummary.map((row) => (
            <div className="bar-row" key={row.month}>
              <span>{row.month.slice(0, 3)}</span>
              <div className="bars">
                <i className="payment" style={{ width: `${(row.payments / maxValue) * 100}%` }} />
                <i className="income" style={{ width: `${(row.income / maxValue) * 100}%` }} />
              </div>
              <strong>{money.format(row.balance)}</strong>
            </div>
          ))}
        </div>
      </Card>
      <Card className="debt-brief">
        <p className="overline">Compromisos</p>
        <h2>Resumen de deudas</h2>
        <Kpi title="Cuotas mensuales" value={money.format(totalDebtPayment)} />
        <Kpi title="Deuda restante" value={money.format(totalRemainingDebt)} tone="danger" />
      </Card>
      <Card className="span-2">
        <h2>Cuotas pendientes</h2>
        <Table
          columns={['Descripcion', 'Valor mensual', 'Cuotas faltantes', 'Deuda restante']}
          rows={debts.map((debt) => [
            debt.loan,
            { content: money.format(debt.monthlyPayment), filterValue: debt.monthlyPayment },
            debt.remainingMonths,
            { content: money.format(debt.remainingDebt), filterValue: debt.remainingDebt },
          ])}
        />
      </Card>
    </section>
  );
}
