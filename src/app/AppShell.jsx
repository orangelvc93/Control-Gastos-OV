import { lazy, Suspense, useState } from 'react';
import { useLedger } from '../hooks/useLedger';
import { TransactionSheet } from './components/TransactionSheet';
import { AccountDetailPage, AccountsPage } from './pages/AccountsPage';
import { HomePage } from './pages/HomePage';
import { ManagementPage } from './pages/ManagementPage';
import { CategoriesPage, MorePage, TrashPage } from './pages/MorePages';
import { MovementsPage } from './pages/MovementsPage';
import { NotificationsPage, SettingsPage } from './pages/NotifyPages';
import { Icon } from './ui/Icon';
import { useNotify } from './ui/Toast';
import { useHashRoute } from './useHashRoute';

// Las gráficas (recharts) pesan: se descargan solo al abrir el dashboard.
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const DebtPlanPage = lazy(() => import('./pages/DebtPlanPage').then((module) => ({ default: module.DebtPlanPage })));
const LegacyBook = lazy(() => import('../features/legacy/LegacyBook').then((module) => ({ default: module.LegacyBook })));

const navItems = [
  ['/', 'home', 'Inicio'],
  ['/movimientos', 'list', 'Movimientos'],
  ['/cuentas', 'wallet', 'Cuentas'],
  ['/mas', 'more', 'Más'],
];

// En el menú lateral (escritorio) Dashboard y Gestión tienen entrada propia; en el celular están en la barra superior y en "Más".
const sideNavItems = [navItems[0], ['/dashboard', 'chart', 'Dashboard'], navItems[1], navItems[2], ['/gestion', 'tag', 'Gestión'], navItems[3]];

function sectionOf(path, desktop) {
  if (path.startsWith('/movimientos')) return '/movimientos';
  if (path.startsWith('/cuentas')) return '/cuentas';
  if (path === '/') return '/';
  if (desktop && (path === '/gestion' || path === '/dashboard')) return path;
  return '/mas';
}

export function AppShell({ user, onLogout }) {
  const notify = useNotify();
  const ledger = useLedger(user.id, notify);
  const [path, navigate] = useHashRoute();
  const [sheet, setSheet] = useState(null);
  const section = sectionOf(path, false);
  const sideSection = sectionOf(path, true);
  const unread = ledger.notifications.filter((item) => !item.readAt).length;

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
  // confirm: se abre para confirmar un pendiente (el estado ya viene como "Confirmado").
  function openExisting(item, { confirm = false } = {}) {
    if (item.kind !== 'transferencia') {
      setSheet({ existing: item, confirm });
      return;
    }
    const pair = ledger.transactions.filter((transaction) => transaction.transferId === item.transferId);
    const from = pair.find((transaction) => transaction.cents < 0) ?? item;
    const to = pair.find((transaction) => transaction.cents > 0);
    setSheet({ existing: { ...from, cents: -from.cents, toAccountId: to?.accountId }, confirm });
  }

  const pageProps = {
    ledger,
    navigate,
    onSelectTransaction: openExisting,
    onConfirmTransaction: (item) => openExisting(item, { confirm: true }),
    onNewTransaction: openNew,
    onRegisterOccurrence: registerOccurrence,
  };
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
        <Suspense fallback={<p className="page-loading" role="status">Cargando histórico…</p>}>
          <LegacyBook user={user} />
        </Suspense>
      </div>
    );
  } else if (accountMatch) {
    page = <AccountDetailPage {...pageProps} accountId={accountMatch[1]} />;
  } else if (path === '/movimientos') {
    page = <MovementsPage {...pageProps} />;
  } else if (path === '/cuentas') {
    page = <AccountsPage {...pageProps} />;
  } else if (path === '/dashboard') {
    page = (
      <Suspense fallback={<p className="page-loading" role="status">Cargando gráficas…</p>}>
        <DashboardPage {...pageProps} />
      </Suspense>
    );
  } else if (path === '/deudas') {
    page = (
      <Suspense fallback={<p className="page-loading" role="status">Cargando plan…</p>}>
        <DebtPlanPage {...pageProps} />
      </Suspense>
    );
  } else if (path === '/mas') {
    page = <MorePage {...pageProps} onLogout={onLogout} userEmail={user.email} />;
  } else if (path === '/gestion') {
    page = <ManagementPage {...pageProps} />;
  } else if (path === '/avisos') {
    page = <NotificationsPage {...pageProps} />;
  } else if (path === '/ajustes') {
    page = <SettingsPage {...pageProps} />;
  } else if (path === '/categorias') {
    page = <CategoriesPage {...pageProps} />;
  } else if (path === '/papelera') {
    page = <TrashPage {...pageProps} />;
  } else {
    page = <HomePage {...pageProps} />;
  }

  const bell = (
    <a href="#/avisos" className={`icon-button bell ${path === '/avisos' ? 'is-active' : ''}`} aria-label={unread ? `Avisos, ${unread} sin leer` : 'Avisos'}>
      <Icon name="bell" />
      {unread > 0 && <span className="badge" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}
    </a>
  );

  return (
    <div className="app">
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <header className="topbar">
        <a href="#/" className="brand">
          <span className="brand-mark" aria-hidden="true">$</span>
          <span>Control de gastos</span>
        </a>
        <span className="topbar-actions">
          <a href="#/dashboard" className={`icon-button ${path === '/dashboard' ? 'is-active' : ''}`} aria-label="Dashboard">
            <Icon name="chart" />
          </a>
          {bell}
        </span>
      </header>

      <aside className="sidebar">
        <div className="sidebar-head">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">$</span>
            <span>Control de gastos</span>
          </div>
          {bell}
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
          confirm={sheet.confirm}
          recurringItem={sheet.existing?.recurringId ? ledger.recurring.find((item) => item.id === sheet.existing.recurringId) : undefined}
          defaults={sheet.defaults}
          accounts={ledger.accounts}
          categories={ledger.categories}
          installments={ledger.installments}
          onSave={ledger.actions.saveTransaction}
          onSaveFollowing={ledger.actions.saveTransactionAndFollowing}
          onReplace={ledger.actions.replaceTransaction}
          onTrash={ledger.actions.trashTransaction}
          onTrashFollowing={ledger.actions.trashTransactionAndFollowing}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
