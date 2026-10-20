import { useState } from 'react';
import { formatCents } from '../../shared/lib/cents';
import { today } from '../../shared/lib/date';
import { activeTransactions, groupForList, monthKey, monthLabel, monthSummary, shiftMonth } from '../../shared/lib/ledger';
import { TransactionList } from '../components/TransactionList';
import { Amount } from '../ui/Field';
import { Icon } from '../ui/Icon';

const kindFilters = [
  ['todos', 'Todos'],
  ['gasto', 'Gastos'],
  ['ingreso', 'Ingresos'],
  ['transferencia', 'Transferencias'],
];

export function MovementsPage({ ledger, onSelectTransaction, onNewTransaction }) {
  const { accounts, categories, transactions } = ledger;
  const [month, setMonth] = useState(monthKey(today()));
  const [kind, setKind] = useState('todos');
  const [accountId, setAccountId] = useState('');
  const [query, setQuery] = useState('');

  const summary = monthSummary(transactions, month);
  const categoriesById = Object.fromEntries(categories.map((category) => [category.id, category]));
  const text = query.trim().toLowerCase();
  const items = groupForList(activeTransactions(transactions))
    .filter((item) => monthKey(item.date) === month)
    .filter((item) => kind === 'todos' || item.kind === kind)
    .filter((item) => !accountId || item.accountId === accountId || item.toAccountId === accountId)
    .filter((item) => !text
      || item.description.toLowerCase().includes(text)
      || item.note.toLowerCase().includes(text)
      || (categoriesById[item.categoryId]?.name ?? '').toLowerCase().includes(text));
  const filtered = kind !== 'todos' || accountId || text;

  return (
    <div className="page">
      <div className="page-head">
        <h1>Movimientos</h1>
        <div className="month-nav">
          <button type="button" className="icon-button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mes anterior">
            <Icon name="chevronLeft" />
          </button>
          <strong aria-live="polite">{monthLabel(month)}</strong>
          <button type="button" className="icon-button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Mes siguiente">
            <Icon name="chevronRight" />
          </button>
        </div>
      </div>

      <dl className="month-row card">
        <div><dt>Ingresos</dt><dd className="amount amount-positive">{formatCents(summary.income)}</dd></div>
        <div><dt>Gastos</dt><dd className="amount amount-negative">{formatCents(summary.expenses)}</dd></div>
        <div><dt>Balance</dt><dd><Amount cents={summary.balance} /></dd></div>
      </dl>

      <div className="filters">
        <div className="chips" role="group" aria-label="Tipo">
          {kindFilters.map(([value, label]) => (
            <button key={value} type="button" className={`chip ${kind === value ? 'is-active' : ''}`} aria-pressed={kind === value} onClick={() => setKind(value)}>
              {label}
            </button>
          ))}
        </div>
        <div className="filter-row">
          <label className="search">
            <Icon name="search" size={16} />
            <span className="sr-only">Buscar</span>
            <input className="input" type="search" placeholder="Buscar descripción o categoría" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <label>
            <span className="sr-only">Cuenta</span>
            <select className="input" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              <option value="">Todas las cuentas</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
          </label>
        </div>
      </div>

      <section className="card" aria-label={`Movimientos de ${monthLabel(month)}`}>
        {items.length || filtered ? (
          <>
            <TransactionList items={items} accounts={accounts} categories={categories} onSelect={onSelectTransaction} emptyText="Ningún movimiento coincide con los filtros." />
            {filtered && (
              <button type="button" className="link" onClick={() => { setKind('todos'); setAccountId(''); setQuery(''); }}>Quitar filtros</button>
            )}
          </>
        ) : (
          <div className="empty">
            <p>No hay movimientos en {monthLabel(month)}.</p>
            <button type="button" className="btn btn-primary" onClick={() => onNewTransaction()}>Registrar movimiento</button>
          </div>
        )}
      </section>
    </div>
  );
}
