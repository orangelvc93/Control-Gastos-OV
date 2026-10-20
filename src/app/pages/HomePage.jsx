import { formatCents } from '../../shared/lib/cents';
import { today } from '../../shared/lib/date';
import { accountTypeLabels, activeTransactions, groupForList, isCard, monthKey, monthLabel, monthSummary, netWorthSummary } from '../../shared/lib/ledger';
import { dueOccurrences } from '../../shared/lib/recurring';
import { DueList } from '../components/DueList';
import { TransactionList } from '../components/TransactionList';
import { Amount, DebtAmount } from '../ui/Field';

export function HomePage({ ledger, navigate, onSelectTransaction, onConfirmTransaction, onNewTransaction, onRegisterOccurrence }) {
  const { accounts, categories, transactions, balances, recurring } = ledger;
  const due = dueOccurrences(recurring, transactions, today(), { futureDays: 7 });
  const pending = groupForList(activeTransactions(transactions)).filter((item) => item.status === 'pendiente');
  const summary = netWorthSummary(accounts, balances);
  const currentMonth = monthKey(today());
  const month = monthSummary(transactions, currentMonth);
  const recent = groupForList(activeTransactions(transactions)).slice(0, 6);
  const openAccounts = accounts.filter((account) => !account.archivedAt);

  return (
    <div className="page">
      <section className="hero-card" aria-labelledby="net-worth-title">
        <p className="eyebrow" id="net-worth-title">Patrimonio neto</p>
        <p className="hero-amount"><Amount cents={summary.netWorth} /></p>
        <p className="hero-explain">
          Tienes {formatCents(summary.owned)} en tus cuentas − debes {formatCents(summary.owed)} en tarjetas.
        </p>
      </section>

      <section className="stat-grid" aria-label="Resumen">
        <div className="stat">
          <span className="stat-label">Disponible</span>
          <strong className="stat-value">{formatCents(summary.available)}</strong>
          <span className="stat-hint">Cuentas del día a día</span>
        </div>
        <div className="stat">
          <span className="stat-label">Ahorros</span>
          <strong className="stat-value">{formatCents(summary.savings)}</strong>
          <span className="stat-hint">Ahorro e inversión</span>
        </div>
        <div className="stat">
          <span className="stat-label">Deuda en tarjetas</span>
          <strong className="stat-value">{formatCents(summary.owed)}</strong>
          <span className="stat-hint">Cupo libre {formatCents(summary.creditAvailable)}</span>
        </div>
      </section>

      {pending.length > 0 && (
        <section className="card" aria-labelledby="pending-title">
          <div className="card-head">
            <h2 id="pending-title">Por confirmar</h2>
            <span className="pill pill-pending">{pending.length}</span>
          </div>
          <p className="form-hint">Anotados automáticamente o marcados como pendientes: todavía no cuentan en tus saldos.</p>
          <ul className="due-list">
            {pending.slice(0, 5).map((item) => (
              <li key={item.id}>
                <span className="due-text">
                  <strong>{item.description || 'Movimiento'}</strong>
                  <small>{item.date.split('-').reverse().join('/')}</small>
                </span>
                <span className={`amount ${item.kind === 'ingreso' ? 'amount-positive' : item.kind === 'gasto' ? 'amount-negative' : 'amount-zero'}`}>
                  {formatCents(Math.abs(item.cents))}
                </span>
                <button type="button" className="btn btn-secondary btn-small" onClick={() => onConfirmTransaction(item)} aria-label={`Confirmar ${item.description}`}>
                  Confirmar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {due.length > 0 && (
        <section className="card" aria-labelledby="due-title">
          <div className="card-head">
            <h2 id="due-title">Próximos</h2>
            <button type="button" className="link" onClick={() => navigate('/gestion')}>Frecuentes</button>
          </div>
          <DueList due={due} onRegister={onRegisterOccurrence} limit={5} />
        </section>
      )}

      <section className="card" aria-labelledby="month-title">
        <div className="card-head">
          <h2 id="month-title">{monthLabel(currentMonth)}</h2>
          <span className="row-actions">
            <button type="button" className="link" onClick={() => navigate('/dashboard')}>Gráficas</button>
            <button type="button" className="link" onClick={() => navigate('/movimientos')}>Ver mes</button>
          </span>
        </div>
        <dl className="month-row">
          <div><dt>Ingresos</dt><dd className="amount amount-positive">{formatCents(month.income)}</dd></div>
          <div><dt>Gastos</dt><dd className="amount amount-negative">{formatCents(month.expenses)}</dd></div>
          <div><dt>Te queda</dt><dd><Amount cents={month.balance} /></dd></div>
        </dl>
        {month.expenses > month.income && (
          <p className="alert alert-warning" role="status">Este mes llevas gastado más de lo que ha entrado.</p>
        )}
      </section>

      <section className="card" aria-labelledby="accounts-title">
        <div className="card-head">
          <h2 id="accounts-title">Cuentas</h2>
          <button type="button" className="link" onClick={() => navigate('/cuentas')}>Ver todas</button>
        </div>
        <ul className="account-mini-list">
          {openAccounts.map((account) => (
            <li key={account.id}>
              <button type="button" className="account-mini" onClick={() => navigate(`/cuentas/${account.id}`)}>
                <span className={`dot dot-${account.color}`} aria-hidden="true" />
                <span className="account-mini-name">
                  {account.name}
                  <small>{isCard(account) ? 'Deuda' : accountTypeLabels[account.type]}</small>
                </span>
                {isCard(account) ? <DebtAmount balanceCents={balances[account.id] ?? 0} /> : <Amount cents={balances[account.id] ?? 0} />}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card" aria-labelledby="recent-title">
        <div className="card-head">
          <h2 id="recent-title">Últimos movimientos</h2>
          <button type="button" className="link" onClick={() => navigate('/movimientos')}>Ver todos</button>
        </div>
        {recent.length ? (
          <TransactionList items={recent} accounts={accounts} categories={categories} onSelect={onSelectTransaction} />
        ) : (
          <div className="empty">
            <p>Aún no registras movimientos. Tus cuentas empiezan con el saldo que tienen hoy.</p>
            <button type="button" className="btn btn-primary" onClick={() => onNewTransaction()}>Registrar el primero</button>
          </div>
        )}
      </section>
    </div>
  );
}
