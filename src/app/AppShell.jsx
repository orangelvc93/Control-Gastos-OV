import { useState } from 'react';
import { useLedger } from '../hooks/useLedger';
import { LegacyBook } from '../features/legacy/LegacyBook';
import { TransactionSheet } from './components/TransactionSheet';
import { AccountDetailPage, AccountsPage } from './pages/AccountsPage';
import { HomePage } from './pages/HomePage';
import { ManagementPage } from './pages/ManagementPage';
import { CategoriesPage, MorePage, TrashPage } from './pages/MorePages';
import { MovementsPage } from './pages/MovementsPage';
import { Icon } from './ui/Icon';
import { useNotify } from './ui/Toast';
import { useHashRoute } from './useHashRoute';

const navItems = [
  ['/', 'home', 'Inicio'],
  ['/movimientos', 'list', 'Movimientos'],
  ['/cuentas', 'wallet', 'Cuentas'],
  ['/mas', 'more', 'Más'],
];

// En el menú lateral (escritorio) Gestión tiene entrada propia; en el celular está dentro de "Más".
const sideNavItems = [...navItems.slice(0, 3), ['/gestion', 'tag', 'Gestión'], navItems[3]];

function sectionOf(path, desktop) {
  if (path.startsWith('/movimientos')) return '/movimientos';
  if (path.startsWith('/cuentas')) return '/cuentas';
  if (path === '/') return '/';
  if (desktop && path === '/gestion') return '/gestion';
  return '/mas';
}

export function AppShell({ user, onLogout }) {
  const notify = useNotify();
  const ledger = useLedger(user.id, notify);
  const [path, navigate] = useHashRoute();
  const [sheet, setSheet] = useState(null);
  const section = sectionOf(path, false);
  const sideSection = sectionOf(path, true);

  function openNew(defaults = {}) {
    setSheet({ defaults });
  }

  function registerOccurrence({ item, date }) {
    openNew({
      kind: item.kind,
      cents: item.cents,
      accountId: item.accountId,
      toAccountId: item.toAccountId ?? '',
      categoryId: item.categoryId ?? '',
      description: item.name,
      note: item.note,
      date,
      recurringId: item.id,
      occurrenceDate: date,
    });
  }

  // En una transferencia se edita siempre desde la fila de salida, con su cuenta destino.
  function openExisting(item) {
    if (item.kind !== 'transferencia') {
      setSheet({ existing: item });
      return;
    }
    const pair = ledger.transactions.filter((transaction) => transaction.transferId === item.transferId);
    const from = pair.find((transaction) => transaction.cents < 0) ?? item;
    const to = pair.find((transaction) => transaction.cents > 0);
    setSheet({ existing: { ...from, cents: -from.cents, toAccountId: to?.accountId } });
  }

  const pageProps = { ledger, navigate, onSelectTransaction: openExisting, onNewTransaction: openNew, onRegisterOccurrence: registerOccurrence };
  const accountMatch = path.match(/^\/cuentas\/([\w-]+)$/);

  let page;
  if (ledger.status === 'loading') {
    page = <p className="page-loading" role="status">Cargando tus cuentas…</p>;
  } else if (ledger.status === 'error') {
    page = (
      <div className="page">
        <p className="alert alert-error" role="alert">No se pudieron cargar los datos: {ledger.loadError}</p>
        <button type="button" className="btn btn-primary" onClick={ledger.reload}>Reintentar</button>
      </div>
    );
  } else if (path === '/historico') {
    page = (
      <div className="page page-wide">
        <button type="button" className="back" onClick={() => navigate('/mas')}><Icon name="chevronLeft" size={18} /> Más</button>
        <p className="alert alert-info">Esta es la app anterior, con tu histórico de 2026. Los datos nuevos se registran en Inicio, Movimientos y Cuentas.</p>
        <LegacyBook user={user} />
      </div>
    );
  } else if (accountMatch) {
    page = <AccountDetailPage {...pageProps} accountId={accountMatch[1]} />;
  } else if (path === '/movimientos') {
    page = <MovementsPage {...pageProps} />;
  } else if (path === '/cuentas') {
    page = <AccountsPage {...pageProps} />;
  } else if (path === '/mas') {
    page = <MorePage {...pageProps} onLogout={onLogout} userEmail={user.email} />;
  } else if (path === '/gestion') {
    page = <ManagementPage {...pageProps} />;
  } else if (path === '/categorias') {
    page = <CategoriesPage {...pageProps} />;
  } else if (path === '/papelera') {
    page = <TrashPage {...pageProps} />;
  } else {
    page = <HomePage {...pageProps} />;
  }

  return (
    <div className="app">
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">$</span>
          <span>Control de gastos</span>
        </div>
        <button type="button" className="btn btn-primary btn-block" onClick={() => openNew()}>
          <Icon name="plus" size={18} /> Nuevo movimiento
        </button>
        <nav aria-label="Principal">
          <ul className="side-nav">
            {sideNavItems.map(([to, icon, label]) => (
              <li key={to}>
                <a href={`#${to}`} className={sideSection === to ? 'is-active' : ''} aria-current={sideSection === to ? 'page' : undefined}>
                  <Icon name={icon} /> {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <main id="contenido" className="content" tabIndex={-1}>
        {page}
      </main>

      <nav className="tabbar" aria-label="Principal">
        {navItems.slice(0, 2).map(([to, icon, label]) => (
          <a key={to} href={`#${to}`} className={section === to ? 'is-active' : ''} aria-current={section === to ? 'page' : undefined}>
            <Icon name={icon} /> <span>{label}</span>
          </a>
        ))}
        <button type="button" className="fab" onClick={() => openNew()} aria-label="Nuevo movimiento">
          <Icon name="plus" size={26} />
        </button>
        {navItems.slice(2).map(([to, icon, label]) => (
          <a key={to} href={`#${to}`} className={section === to ? 'is-active' : ''} aria-current={section === to ? 'page' : undefined}>
            <Icon name={icon} /> <span>{label}</span>
          </a>
        ))}
      </nav>

      {sheet && (
        <TransactionSheet
          existing={sheet.existing}
          defaults={sheet.defaults}
          accounts={ledger.accounts}
          categories={ledger.categories}
          onSave={ledger.actions.saveTransaction}
          onReplace={ledger.actions.replaceTransaction}
          onTrash={ledger.actions.trashTransaction}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
