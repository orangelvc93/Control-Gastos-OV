import { useState } from 'react';
import { formatCents } from '../../shared/lib/cents';
import { today } from '../../shared/lib/date';
import { dueOccurrences, frequencyDetail, frequencyLabels, nextOccurrence } from '../../shared/lib/recurring';
import { AccountSheet } from '../components/AccountSheet';
import { DueList } from '../components/DueList';
import { RecurringSheet } from '../components/RecurringSheet';
import { LoanSheet } from './LoanPanels';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Icon } from '../ui/Icon';

const accountShortcuts = [
  ['ahorro', 'Cuenta de ahorros', 'Banco, cooperativa o cuenta de metas'],
  ['corriente', 'Cuenta corriente', 'Cuenta con chequera o de uso diario'],
  ['tarjeta_credito', 'Tarjeta de crédito', 'Cupo, día de corte y día de pago'],
  ['efectivo', 'Efectivo', 'Billetera o caja chica'],
  ['inversion', 'Inversión o fideicomiso', 'Anefi, fondos, acciones…'],
  ['poliza', 'Póliza', 'Depósito a plazo fijo'],
];

export function ManagementPage({ ledger, navigate, onRegisterOccurrence }) {
  const { accounts, categories, recurring, transactions, actions } = ledger;
  const [accountType, setAccountType] = useState(null);
  const [creatingLoan, setCreatingLoan] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState(null);
  const [pausing, setPausing] = useState(null);
  const [showDebitHelp, setShowDebitHelp] = useState(false);
  const todayDate = today();
  const due = dueOccurrences(recurring, transactions, todayDate);
  const accountsById = Object.fromEntries(accounts.map((account) => [account.id, account]));
  const categoriesById = Object.fromEntries(categories.map((category) => [category.id, category]));
  const active = recurring.filter((item) => !item.archivedAt);
  const paused = recurring.filter((item) => item.archivedAt);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Gestión</h1>
      </div>

      <section className="card" aria-labelledby="mg-accounts">
        <div className="card-head">
          <h2 id="mg-accounts">Crear una cuenta</h2>
          <button type="button" className="link" onClick={() => navigate('/cuentas')}>Ver mis cuentas</button>
        </div>
        <div className="tile-grid">
          {accountShortcuts.map(([type, title, hint]) => (
            <button key={type} type="button" className="tile" onClick={() => setAccountType(type)}>
              <Icon name={type === 'tarjeta_credito' ? 'card' : 'wallet'} />
              <strong>{title}</strong>
              <small>{hint}</small>
            </button>
          ))}
          <button type="button" className="tile" onClick={() => setCreatingLoan(true)}>
            <Icon name="wallet" />
            <strong>Crédito o préstamo</strong>
            <small>Banco, vehículo, casa o de un familiar</small>
          </button>
          <button type="button" className="tile" onClick={() => setShowDebitHelp(!showDebitHelp)} aria-expanded={showDebitHelp}>
            <Icon name="card" />
            <strong>Tarjeta de débito</strong>
            <small>Usa el dinero de tu cuenta bancaria</small>
          </button>
        </div>
        {showDebitHelp && (
          <p className="alert alert-info">
            Una tarjeta de débito no tiene saldo propio: cobra directamente de tu cuenta de ahorros o corriente. No hace falta crearla aparte. Cuando pagues con débito, registra el gasto en esa cuenta (por ejemplo, Pichincha Ahorros).
          </p>
        )}
      </section>

      <section className="card" aria-labelledby="mg-due">
        <div className="card-head">
          <h2 id="mg-due">Próximos y sin registrar</h2>
        </div>
        <DueList due={due} onRegister={onRegisterOccurrence} />
      </section>

      <section className="card" aria-labelledby="mg-recurring">
        <div className="card-head">
          <h2 id="mg-recurring">Gastos e ingresos frecuentes</h2>
          <button type="button" className="btn btn-primary btn-small" onClick={() => setEditingRecurring({})}>
            <Icon name="plus" size={16} /> Nuevo
          </button>
        </div>
        <p className="form-hint">Arriendo, servicios, suscripciones, sueldo, ahorro mensual… Se registran solos en su fecha (cada día a las 06:00 y al abrir la app). Los de monto variable quedan pendientes para que confirmes el valor real.</p>
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
                    <button type="button" className="link" onClick={() => setEditingRecurring({ existing: item })} aria-label={`Editar ${item.name}`}>Editar</button>
                    <button type="button" className="link" onClick={() => setPausing(item)} aria-label={`Pausar ${item.name}`}>Pausar</button>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="empty">
            <p>Aún no tienes frecuentes.</p>
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
      </section>

      <section className="card" aria-labelledby="mg-more">
        <h2 id="mg-more">Más ajustes</h2>
        <ul className="menu-list">
          <li>
            <button type="button" className="menu-item" onClick={() => navigate('/ajustes')}>
              <Icon name="bell" />
              <span><strong>Avisos y Telegram</strong><small>Cuándo avisarte y conectar tu Telegram</small></span>
              <Icon name="chevronRight" size={18} />
            </button>
          </li>
          <li>
            <button type="button" className="menu-item" onClick={() => navigate('/categorias')}>
              <Icon name="tag" />
              <span><strong>Categorías</strong><small>Ingresos, gastos y deducibles del SRI</small></span>
              <Icon name="chevronRight" size={18} />
            </button>
          </li>
        </ul>
        <p className="form-hint">Próximamente: presupuestos por categoría, metas de ahorro, créditos y préstamos, lista de compras.</p>
      </section>

      {accountType && (
        <AccountSheet
          accounts={accounts}
          presetType={accountType}
          onSave={(values) => actions.saveAccount({ ...values, sortOrder: accounts.length + 1 })}
          onClose={() => setAccountType(null)}
        />
      )}
      {editingRecurring && (
        <RecurringSheet
          existing={editingRecurring.existing}
          accounts={accounts}
          categories={categories}
          onSave={actions.saveRecurring}
          onClose={() => setEditingRecurring(null)}
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
      {creatingLoan && <LoanSheet accounts={accounts} onSave={actions.saveLoan} onClose={() => setCreatingLoan(false)} />}
    </div>
  );
}
