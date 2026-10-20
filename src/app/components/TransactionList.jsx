import { formatCents } from '../../shared/lib/cents';
import { formatDayLabel, groupByDate, kindLabels } from '../../shared/lib/ledger';
import { Amount } from '../ui/Field';
import { Icon } from '../ui/Icon';

function itemTitle(item, categoriesById, accountsById) {
  if (item.description) return item.description;
  if (item.kind === 'transferencia') return 'Transferencia';
  if (item.kind === 'ajuste') return 'Ajuste de saldo';
  return categoriesById[item.categoryId]?.name ?? kindLabels[item.kind];
}

function itemMeta(item, categoriesById, accountsById, accountView) {
  const account = accountsById[item.accountId]?.name ?? 'Cuenta';
  if (item.kind === 'transferencia') {
    if (accountView) return item.cents < 0 ? 'Transferencia enviada' : 'Transferencia recibida';
    return `${account} → ${accountsById[item.toAccountId]?.name ?? 'Cuenta'}`;
  }
  const category = item.kind === 'ajuste' ? 'Ajuste de saldo' : categoriesById[item.categoryId]?.name ?? '';
  return accountView ? category : [category, account].filter(Boolean).join(' · ');
}

// items: movimientos ya agrupados (groupForList) o filas de una cuenta con runningCents.
export function TransactionList({ items, accounts, categories, onSelect, accountView = false, debtView = false, emptyText = 'No hay movimientos.' }) {
  const accountsById = Object.fromEntries(accounts.map((account) => [account.id, account]));
  const categoriesById = Object.fromEntries(categories.map((category) => [category.id, category]));

  if (!items.length) return <p className="empty">{emptyText}</p>;

  return (
    <div className="tx-groups">
      {groupByDate(items).map((group) => (
        <section key={group.date} className="tx-group" aria-label={formatDayLabel(group.date)}>
          <h3 className="tx-date">{formatDayLabel(group.date)}</h3>
          <ul className="tx-list">
            {group.items.map((item) => {
              const transferInList = item.kind === 'transferencia' && !accountView;
              return (
                <li key={item.id}>
                  <button type="button" className="tx-item" onClick={() => onSelect(item)}>
                    <span className={`tx-badge tx-badge-${item.kind}`} aria-hidden="true">
                      {item.kind === 'transferencia' ? <Icon name="arrowRight" size={16} /> : item.kind === 'ingreso' ? '+' : item.kind === 'gasto' ? '−' : '±'}
                    </span>
                    <span className="tx-text">
                      <span className="tx-title">{itemTitle(item, categoriesById, accountsById)}</span>
                      <span className="tx-meta">
                        {itemMeta(item, categoriesById, accountsById, accountView)}
                        {item.status === 'pendiente' && <span className="pill pill-pending">Pendiente</span>}
                      </span>
                    </span>
                    <span className="tx-amounts">
                      {transferInList
                        ? <span className="amount amount-zero">{formatCents(item.pairCents)}</span>
                        : <Amount cents={item.cents} signed />}
                      {accountView && item.runningCents !== undefined && (
                        <span className="tx-running">{debtView ? `Deuda ${formatCents(-item.runningCents)}` : `Saldo ${formatCents(item.runningCents)}`}</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
