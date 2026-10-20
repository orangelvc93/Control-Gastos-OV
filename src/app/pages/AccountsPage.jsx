import { useState } from 'react';
import { formatCents, sumCents } from '../../shared/lib/cents';
import { accountBreakdown, accountTypeLabels, isCard, withRunningBalance } from '../../shared/lib/ledger';
import { AccountSheet, AdjustBalanceSheet } from '../components/AccountSheet';
import { TransactionList } from '../components/TransactionList';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Amount, DebtAmount } from '../ui/Field';
import { Icon } from '../ui/Icon';

function AccountCard({ account, balance, onOpen }) {
  const card = isCard(account);
  const debt = -balance;
  const usedPercent = card && account.creditLimitCents ? Math.min(100, Math.max(0, (debt / account.creditLimitCents) * 100)) : 0;

  return (
    <li>
      <button type="button" className="account-card" onClick={onOpen}>
        <span className="account-card-top">
          <span className={`dot dot-${account.color}`} aria-hidden="true" />
          <span className="account-card-name">
            {account.name}
            <small>{[account.institution, accountTypeLabels[account.type]].filter(Boolean).join(' · ')}</small>
          </span>
          <span className="account-card-balance">
            {card ? <><small>Deuda</small><DebtAmount balanceCents={balance} /></> : <Amount cents={balance} />}
          </span>
        </span>
        {card && account.creditLimitCents !== null && (
          <span className="credit">
            <span className="credit-bar" aria-hidden="true"><span style={{ width: `${usedPercent}%` }} /></span>
            <span className="credit-text">
              Cupo libre {formatCents(account.creditLimitCents - debt)} de {formatCents(account.creditLimitCents)} · usado {usedPercent.toLocaleString('es-EC', { maximumFractionDigits: 1 })} %
            </span>
          </span>
        )}
      </button>
    </li>
  );
}

export function AccountsPage({ ledger, navigate }) {
  const { accounts, balances, actions } = ledger;
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const open = accounts.filter((account) => !account.archivedAt);
  const archived = accounts.filter((account) => account.archivedAt);

  const groups = [
    ['Disponible', open.filter((account) => !isCard(account) && !account.isSavings)],
    ['Ahorros e inversiones', open.filter((account) => !isCard(account) && account.isSavings)],
    ['Tarjetas de crédito', open.filter(isCard)],
  ].filter(([, list]) => list.length);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Cuentas</h1>
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          <Icon name="plus" size={18} /> Nueva cuenta
        </button>
      </div>

      {groups.map(([title, list]) => (
        <section key={title} className="account-group" aria-label={title}>
          <div className="group-head">
            <h2>{title}</h2>
            <span className="group-total">{formatCents(sumCents(list, (account) => (isCard(account) ? -balances[account.id] : balances[account.id])))}</span>
          </div>
          <ul className="account-list">
            {list.map((account) => (
              <AccountCard key={account.id} account={account} balance={balances[account.id] ?? 0} onOpen={() => navigate(`/cuentas/${account.id}`)} />
            ))}
          </ul>
        </section>
      ))}

      {archived.length > 0 && (
        <section className="account-group">
          <button type="button" className="link" onClick={() => setShowArchived(!showArchived)} aria-expanded={showArchived}>
            {showArchived ? 'Ocultar' : 'Ver'} cuentas archivadas ({archived.length})
          </button>
          {showArchived && (
            <ul className="account-list">
              {archived.map((account) => (
                <AccountCard key={account.id} account={account} balance={balances[account.id] ?? 0} onOpen={() => navigate(`/cuentas/${account.id}`)} />
              ))}
            </ul>
          )}
        </section>
      )}

      {creating && <AccountSheet onSave={(values) => actions.saveAccount({ ...values, sortOrder: accounts.length + 1 })} onClose={() => setCreating(false)} />}
    </div>
  );
}

export function AccountDetailPage({ ledger, accountId, navigate, onSelectTransaction, onNewTransaction }) {
  const { accounts, categories, transactions, actions } = ledger;
  const [editing, setEditing] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const account = accounts.find((item) => item.id === accountId);

  if (!account) {
    return (
      <div className="page">
        <p className="empty">No se encontró la cuenta.</p>
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/cuentas')}>Volver a cuentas</button>
      </div>
    );
  }

  const card = isCard(account);
  const breakdown = accountBreakdown(account, transactions);
  const rows = withRunningBalance(account, transactions);
  const lines = [
    ['Saldo inicial', breakdown.opening, `desde el ${account.openingDate.split('-').reverse().join('/')}`],
    ['Ingresos', breakdown.income],
    ['Gastos', breakdown.expenses],
    ['Transferencias', breakdown.transfers],
    ['Ajustes', breakdown.adjustments],
  ].filter(([label, cents]) => label === 'Saldo inicial' || cents !== 0);

  return (
    <div className="page">
      <button type="button" className="back" onClick={() => navigate('/cuentas')}>
        <Icon name="chevronLeft" size={18} /> Cuentas
      </button>

      <section className="hero-card">
        <p className="eyebrow">{[account.institution, accountTypeLabels[account.type]].filter(Boolean).join(' · ')}{account.archivedAt ? ' · Archivada' : ''}</p>
        <h1 className="hero-title">{account.name}</h1>
        <p className="hero-amount">
          {card ? <><small>Deuda </small><DebtAmount balanceCents={breakdown.balance} /></> : <Amount cents={breakdown.balance} />}
        </p>
        <details className="explain">
          <summary>¿De dónde sale este saldo?</summary>
          <dl>
            {lines.map(([label, cents, hint]) => (
              <div key={label}>
                <dt>{label}{hint && <small> {hint}</small>}</dt>
                <dd><Amount cents={cents} signed={label !== 'Saldo inicial'} /></dd>
              </div>
            ))}
            <div className="explain-total"><dt>Saldo</dt><dd><Amount cents={breakdown.balance} /></dd></div>
          </dl>
          {breakdown.pending !== 0 && <p className="form-hint">Hay {formatCents(Math.abs(breakdown.pending))} en movimientos pendientes que todavía no cuentan.</p>}
        </details>
        {card && account.creditLimitCents !== null && (
          <p className="hero-explain">
            Cupo libre {formatCents(account.creditLimitCents + breakdown.balance)} de {formatCents(account.creditLimitCents)}
            {account.statementDay && ` · corte el día ${account.statementDay}`}
            {account.dueDay && ` · pago hasta el día ${account.dueDay}`}
          </p>
        )}
        <div className="hero-actions">
          <button type="button" className="btn btn-primary" onClick={() => onNewTransaction({ accountId: account.id, kind: card ? 'gasto' : undefined })}>
            <Icon name="plus" size={18} /> Movimiento
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setAdjusting(true)}>Ajustar saldo</button>
          <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>Editar</button>
          <button type="button" className="btn btn-secondary" onClick={() => setConfirmArchive(true)}>{account.archivedAt ? 'Reactivar' : 'Archivar'}</button>
        </div>
      </section>

      <section className="card" aria-label="Movimientos de la cuenta">
        <TransactionList
          items={rows}
          accounts={accounts}
          categories={categories}
          onSelect={onSelectTransaction}
          accountView
          debtView={card}
          emptyText="Sin movimientos todavía. El saldo es el saldo inicial."
        />
      </section>

      {editing && <AccountSheet existing={account} onSave={actions.saveAccount} onClose={() => setEditing(false)} />}
      {adjusting && <AdjustBalanceSheet account={account} currentCents={breakdown.balance} onSave={(values) => actions.saveTransaction(values)} onClose={() => setAdjusting(false)} />}
      {confirmArchive && (
        <ConfirmDialog
          title={account.archivedAt ? '¿Reactivar la cuenta?' : '¿Archivar la cuenta?'}
          message={account.archivedAt
            ? 'Volverá a aparecer en tus cuentas y en los formularios.'
            : 'Se oculta de tus cuentas y deja de contar en el resumen. Sus movimientos se conservan y puedes reactivarla cuando quieras.'}
          confirmLabel={account.archivedAt ? 'Reactivar' : 'Archivar'}
          onConfirm={() => actions.archiveAccount(account, !account.archivedAt)}
          onClose={() => setConfirmArchive(false)}
        />
      )}
    </div>
  );
}
