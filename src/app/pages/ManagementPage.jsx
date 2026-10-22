import { useState } from 'react';
import { today } from '../../shared/lib/date';
import { dueOccurrences } from '../../shared/lib/recurring';
import { AccountSheet } from '../components/AccountSheet';
import { DueList } from '../components/DueList';
import { RecurringPanel } from '../components/RecurringPanel';
import { LoanSheet } from './LoanPanels';
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
  const { accounts, recurring, transactions, actions } = ledger;
  const [accountType, setAccountType] = useState(null);
  const [creatingLoan, setCreatingLoan] = useState(false);
  const [showDebitHelp, setShowDebitHelp] = useState(false);
  const todayDate = today();
  const due = dueOccurrences(recurring, transactions, todayDate);

  return (
    // En pantallas grandes: crear cuenta a todo el ancho; frecuentes a la derecha y el resto a la izquierda.
    <div className="page page-split min-[1100px]:grid-cols-2 min-[1100px]:grid-flow-dense min-[1100px]:items-start">
      <div className="page-head min-[1100px]:col-span-2">
        <h1>Gestión</h1>
      </div>

      <section className="card min-[1100px]:col-span-2" aria-labelledby="mg-accounts">
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

      <RecurringPanel ledger={ledger} className="min-[1100px]:col-start-2 min-[1100px]:row-span-2" />

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
      {creatingLoan && <LoanSheet accounts={accounts} onSave={actions.saveLoan} onClose={() => setCreatingLoan(false)} />}
    </div>
  );
}
