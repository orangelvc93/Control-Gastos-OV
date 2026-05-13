import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { money } from '../../shared/lib/money';
import { Card } from '../../shared/ui/Card';
import { Kpi } from '../../shared/ui/Kpi';
import { SectionTitle } from '../../shared/ui/SectionTitle';
import { Select } from '../../shared/ui/FormControls';
import { Table } from '../../shared/ui/Table';

const chartColors = {
  purple: '#8b5cf6',
  orange: '#ff8a2a',
  green: '#22c55e',
  blue: '#38bdf8',
  red: '#fb7185',
  pink: '#f472b6',
  yellow: '#facc15',
};

function savingsChartRows(accountRows, months) {
  return months.map((month) => {
    const row = accountRows.find((item) => item.month === month);

    return {
      month: month.slice(0, 3),
      interest: row ? row.interest : null,
      final: row ? row.final : null,
    };
  });
}

function formatTooltip(value) {
  return value === null || value === undefined ? '-' : money.format(value);
}

export function Dashboard({
  debts,
  monthlySummary,
  savingsGrowthSummary,
  selectedMonth,
  selectedSummary,
  setSelectedMonth,
  totalDebtPayment,
  totalRemainingDebt,
}) {
  const maxValue = Math.max(...monthlySummary.map((item) => Math.max(item.payments, item.income)), 1);
  const months = monthlySummary.map((item) => item.month);

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
      <Card className="span-2">
        <p className="overline">Ahorros</p>
        <h2>Crecimiento de intereses y saldos</h2>
        {savingsGrowthSummary.length ? (
          <div className="savings-growth-grid">
            {savingsGrowthSummary.map((account) => {
              const accentColor = chartColors[account.color] ?? chartColors.purple;
              const chartRows = savingsChartRows(account.rows, months);

              return (
                <article className={`savings-growth-card savings-growth-${account.color}`} key={account.name}>
                  <div className="savings-growth-title">
                    <h3>{account.name}</h3>
                    <span>{account.rows.length} registros</span>
                  </div>
                  <div className="savings-growth-kpis">
                    <span>Interes acumulado <strong>{money.format(account.totalInterest)}</strong></span>
                    <span>Ultimo saldo <strong>{money.format(account.lastFinal)}</strong></span>
                  </div>
                  <div className="savings-line-chart">
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={chartRows} margin={{ top: 14, right: 18, left: 0, bottom: 4 }}>
                        <CartesianGrid stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
                        <XAxis dataKey="month" stroke="rgba(246,240,234,0.72)" tickLine={false} />
                        <YAxis yAxisId="interest" stroke={accentColor} tickFormatter={(value) => money.format(value)} tickLine={false} width={76} />
                        <YAxis yAxisId="final" orientation="right" stroke="rgba(255,255,255,0.78)" tickFormatter={(value) => money.format(value)} tickLine={false} width={76} />
                        <Tooltip formatter={formatTooltip} contentStyle={{ background: '#151022', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 12, color: '#f6f0ea' }} />
                        <Legend />
                        <Line yAxisId="interest" type="monotone" dataKey="interest" name="Interes ganado" stroke={accentColor} strokeWidth={3} dot={{ r: 4 }} connectNulls={false} />
                        <Line yAxisId="final" type="monotone" dataKey="final" name="Saldo final" stroke="rgba(255,255,255,0.78)" strokeWidth={3} dot={{ r: 4 }} connectNulls={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="notice-line">No hay datos de ahorro para graficar todavia.</p>
        )}
      </Card>
    </section>
  );
}
