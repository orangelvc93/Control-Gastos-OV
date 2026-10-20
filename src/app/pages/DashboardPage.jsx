import { useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { formatCents } from '../../shared/lib/cents';
import { today } from '../../shared/lib/date';
import {
  accountBalanceBars, cardUsage, monthlyIncomeExpenses, netWorthSeries, periodMonths, periodTotals, periods, totalsByCategory,
} from '../../shared/lib/dashboard';
import { monthKey, monthLabel } from '../../shared/lib/ledger';
import { Amount } from '../ui/Field';

// Colores de series validados (dataviz validate_palette.js, modo oscuro sobre #15111f): ingresos azul, gastos naranja.
const COLORS = {
  income: '#3987e5',
  expense: '#d95926',
  net: '#9085e9',
  balance: '#199e70',
};
const axis = { stroke: '#968ca8', fontSize: 12 };
const grid = 'rgba(255,255,255,0.08)';
const money = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const compact = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });

function ChartTooltip({ active, payload, label, labelFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <strong>{labelFormatter ? labelFormatter(label, payload) : label}</strong>
      {payload.map((entry) => (
        <span key={entry.dataKey}>
          <i style={{ background: entry.color }} aria-hidden="true" />
          {entry.name}: {money.format(entry.value)}
        </span>
      ))}
    </div>
  );
}

function ChartCard({ title, subtitle, empty, table, children }) {
  return (
    <section className="card chart-card" aria-label={title}>
      <div className="chart-head">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {empty ? <p className="empty">{empty}</p> : children}
      {!empty && table && (
        <details className="explain">
          <summary>Ver como tabla</summary>
          {table}
        </details>
      )}
    </section>
  );
}

function SimpleTable({ head, rows }) {
  return (
    <table className="data-table">
      <thead><tr>{head.map((cell) => <th key={cell} scope="col">{cell}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody>
    </table>
  );
}

function CategoryBars({ data, color, label }) {
  const height = Math.max(120, data.length * 40);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }} barCategoryGap={6}>
        <CartesianGrid horizontal={false} stroke={grid} />
        <XAxis type="number" tick={axis} tickFormatter={(value) => compact.format(value)} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" tick={axis} width={110} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<ChartTooltip />} />
        <Bar dataKey="value" name={label} fill={color} radius={[0, 4, 4, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DashboardPage({ ledger }) {
  const { accounts, categories, transactions, balances } = ledger;
  const [period, setPeriod] = useState('6m');
  const todayIso = today();
  const months = periodMonths(period, monthKey(todayIso));
  const totals = periodTotals(transactions, months);
  const monthly = monthlyIncomeExpenses(transactions, months);
  const expensesByCategory = totalsByCategory(transactions, months, categories, 'gasto');
  const incomeByCategory = totalsByCategory(transactions, months, categories, 'ingreso');
  const netWorth = netWorthSeries(accounts, transactions, months, todayIso);
  const balancesData = accountBalanceBars(accounts, balances);
  const cards = cardUsage(accounts, balances);
  const periodText = months.length === 1 ? monthLabel(months[0]) : `${monthLabel(months[0])} – ${monthLabel(months.at(-1))}`;
  const hasMovements = monthly.some((month) => month.ingresos || month.gastos);

  return (
    <div className="page page-dashboard">
      <div className="page-head">
        <h1>Dashboard</h1>
        <div className="chips" role="group" aria-label="Periodo">
          {periods.map(([value, label]) => (
            <button key={value} type="button" className={`chip ${period === value ? 'is-active' : ''}`} aria-pressed={period === value} onClick={() => setPeriod(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="form-hint">{periodText} · solo movimientos confirmados (las transferencias no cuentan como ingreso ni gasto).</p>

      <section className="stat-grid" aria-label="Totales del periodo">
        <div className="stat">
          <span className="stat-label">Ingresos</span>
          <strong className="stat-value">{formatCents(totals.income)}</strong>
        </div>
        <div className="stat">
          <span className="stat-label">Gastos</span>
          <strong className="stat-value">{formatCents(totals.expenses)}</strong>
        </div>
        <div className="stat">
          <span className="stat-label">Te quedó</span>
          <strong className="stat-value"><Amount cents={totals.saved} /></strong>
          <span className="stat-hint">Ingresos − gastos</span>
        </div>
        <div className="stat">
          <span className="stat-label">Tasa de ahorro</span>
          <strong className="stat-value">{totals.savingRate === null ? '—' : `${totals.savingRate.toLocaleString('es-EC', { maximumFractionDigits: 1 })} %`}</strong>
          <span className="stat-hint">Lo que te quedó ÷ ingresos</span>
        </div>
      </section>

      <div className="chart-grid">
        <ChartCard
          title="Ingresos vs. gastos por mes"
          empty={hasMovements ? null : 'Aún no hay ingresos ni gastos confirmados en este periodo.'}
          table={<SimpleTable head={['Mes', 'Ingresos', 'Gastos', 'Diferencia']} rows={monthly.map((month) => [month.fullLabel, money.format(month.ingresos), money.format(month.gastos), money.format(month.ingresos - month.gastos)])} />}
        >
          <div className="chart-legend" aria-hidden="true">
            <span><i style={{ background: COLORS.income }} />Ingresos</span>
            <span><i style={{ background: COLORS.expense }} />Gastos</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="24%">
              <CartesianGrid vertical={false} stroke={grid} />
              <XAxis dataKey="label" tick={{ ...axis, fontSize: 11 }} interval={monthly.length > 6 ? 'preserveStartEnd' : 0} axisLine={false} tickLine={false} />
              <YAxis tick={axis} tickFormatter={(value) => compact.format(value)} width={56} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<ChartTooltip labelFormatter={(label, payload) => payload[0]?.payload.fullLabel ?? label} />} />
              <Bar dataKey="ingresos" name="Ingresos" fill={COLORS.income} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="gastos" name="Gastos" fill={COLORS.expense} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Patrimonio neto"
          subtitle="Lo que tienes − lo que debes, al cierre de cada día"
          empty={netWorth.length < 2 ? 'Se verá la evolución a partir de mañana.' : null}
        >
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={netWorth} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={grid} />
              <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tick={axis} tickFormatter={(value) => compact.format(value)} width={64} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip cursor={{ stroke: '#968ca8', strokeDasharray: '3 3' }} content={<ChartTooltip />} />
              <Line type="monotone" dataKey="patrimonio" name="Patrimonio" stroke={COLORS.net} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Gastos por categoría"
          empty={expensesByCategory.length ? null : 'Sin gastos confirmados en este periodo.'}
          table={<SimpleTable head={['Categoría', 'Total', '% del gasto']} rows={expensesByCategory.map((item) => [item.name, money.format(item.value), `${item.share.toLocaleString('es-EC', { maximumFractionDigits: 1 })} %`])} />}
        >
          <CategoryBars data={expensesByCategory} color={COLORS.expense} label="Gasto" />
        </ChartCard>

        <ChartCard
          title="Ingresos por categoría"
          empty={incomeByCategory.length ? null : 'Sin ingresos confirmados en este periodo.'}
          table={<SimpleTable head={['Categoría', 'Total', '% del ingreso']} rows={incomeByCategory.map((item) => [item.name, money.format(item.value), `${item.share.toLocaleString('es-EC', { maximumFractionDigits: 1 })} %`])} />}
        >
          <CategoryBars data={incomeByCategory} color={COLORS.income} label="Ingreso" />
        </ChartCard>

        <ChartCard
          title="Saldo por cuenta"
          subtitle="Hoy, sin tarjetas de crédito"
          table={<SimpleTable head={['Cuenta', 'Saldo']} rows={balancesData.map((item) => [item.name, money.format(item.value)])} />}
        >
          <CategoryBars data={balancesData} color={COLORS.balance} label="Saldo" />
        </ChartCard>

        {cards.length > 0 && (
          <ChartCard title="Tarjetas de crédito" subtitle="Uso del cupo hoy">
            <ul className="usage-list">
              {cards.map((card) => (
                <li key={card.name}>
                  <div className="usage-head">
                    <strong>{card.name}</strong>
                    <span>Debes {formatCents(card.debt)}{card.limit ? ` de ${formatCents(card.limit)}` : ''}</span>
                  </div>
                  {card.percent !== null && (
                    <>
                      <div className="credit-bar" role="img" aria-label={`Uso del cupo ${card.percent.toFixed(1)} %`}>
                        <span style={{ width: `${Math.min(100, card.percent)}%` }} />
                      </div>
                      <small>{card.percent.toLocaleString('es-EC', { maximumFractionDigits: 1 })} % usado · libre {formatCents(card.limit - card.debt)}</small>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </ChartCard>
        )}
      </div>
    </div>
  );
}
