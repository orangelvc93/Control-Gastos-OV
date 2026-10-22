import { useState } from 'react';
import { formatCents } from '../../shared/lib/cents';
import { today } from '../../shared/lib/date';
import { frequencyDetail, frequencyLabels, nextOccurrence } from '../../shared/lib/recurring';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Icon } from '../ui/Icon';
import { RecurringSheet } from './RecurringSheet';

// Gastos e ingresos frecuentes: en Gestión todos; dentro de una cuenta, los que salen de ella o llegan a ella
// (y uno nuevo ya trae esa cuenta elegida).
export function RecurringPanel({ ledger, account, className = '' }) {
  const { accounts, categories, recurring, actions } = ledger;
  const [editing, setEditing] = useState(null);
  const [pausing, setPausing] = useState(null);
  const todayDate = today();
  const accountsById = Object.fromEntries(accounts.map((item) => [item.id, item]));
  const categoriesById = Object.fromEntries(categories.map((item) => [item.id, item]));
  const mine = account ? recurring.filter((item) => item.accountId === account.id || item.toAccountId === account.id) : recurring;
  const active = mine.filter((item) => !item.archivedAt);
  const paused = mine.filter((item) => item.archivedAt);
  const titleId = account ? `recurring-${account.id}` : 'mg-recurring';

  return (
    <section className={`card ${className}`} aria-labelledby={titleId}>
      <div className="card-head">
        <h2 id={titleId}>{account ? 'Frecuentes de esta cuenta' : 'Gastos e ingresos frecuentes'}</h2>
        <button type="button" className="btn btn-primary btn-small" onClick={() => setEditing({})}>
          <Icon name="plus" size={16} /> Nuevo
        </button>
      </div>
      <p className="form-hint">
        {account
          ? `Lo que sale de ${account.name} o llega a ella cada cierto tiempo: sueldo, aportes, pagos, ahorro mensual… Se registran solos en su fecha.`
          : 'Arriendo, servicios, suscripciones, sueldo, ahorro mensual… Se registran solos en su fecha (cada día a las 06:00 y al abrir la app). Los de monto variable quedan pendientes para que confirmes el valor real.'}
      </p>
      {active.length ? (
        <ul className="category-list">
          {active.map((item) => {
            const next = nextOccurrence(item, todayDate);
            const where = item.kind === 'transferencia'
              ? `${accountsById[item.accountId]?.name} → ${accountsById[item.toAccountId]?.name}`
              : `${categoriesById[item.categoryId]?.name ?? ''} · ${accountsById[item.accountId]?.name ?? ''}`;
            return (
              <li key={item.id}>
                <span>
                  {item.name} · {formatCents(item.cents)}
                  <small>{frequencyLabels[item.frequency]} · {frequencyDetail(item)} · {where} · {item.fixedAmount ? 'Monto fijo' : 'Monto variable'}</small>
                  <small>{next ? `Próxima: ${next.split('-').reverse().join('/')}` : 'Sin próximas fechas'}</small>
                </span>
                <span className="row-actions">
                  <button type="button" className="link" onClick={() => setEditing({ existing: item })} aria-label={`Editar ${item.name}`}>Editar</button>
                  <button type="button" className="link" onClick={() => setPausing(item)} aria-label={`Pausar ${item.name}`}>Pausar</button>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="empty">
          <p>{account ? 'Esta cuenta no tiene frecuentes.' : 'Aún no tienes frecuentes.'}</p>
        </div>
      )}
      {paused.length > 0 && (
        <details className="explain">
          <summary>Pausados ({paused.length})</summary>
          <ul className="category-list">
            {paused.map((item) => (
              <li key={item.id} className="is-archived">
                <span>{item.name} · {formatCents(item.cents)}<small>{frequencyLabels[item.frequency]}</small></span>
                <span className="row-actions">
                  <button type="button" className="link" onClick={() => actions.archiveRecurring(item, false)}>Reactivar</button>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {editing && (
        <RecurringSheet
          existing={editing.existing}
          defaults={account ? { accountId: account.id, kind: account.isSavings ? 'ingreso' : 'gasto' } : undefined}
          accounts={accounts}
          categories={categories}
          onSave={actions.saveRecurring}
          onClose={() => setEditing(null)}
        />
      )}
      {pausing && (
        <ConfirmDialog
          title="¿Pausar este frecuente?"
          message={`"${pausing.name}" dejará de avisarte. Lo ya registrado se conserva y puedes reactivarlo cuando quieras.`}
          confirmLabel="Pausar"
          onConfirm={() => actions.archiveRecurring(pausing, true)}
          onClose={() => setPausing(null)}
        />
      )}
    </section>
  );
}
