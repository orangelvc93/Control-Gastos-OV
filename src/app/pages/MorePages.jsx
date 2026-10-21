import { useState } from 'react';
import { formatCents } from '../../shared/lib/cents';
import { kindLabels, sriCategoryLabels } from '../../shared/lib/ledger';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Field } from '../ui/Field';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';

export function MorePage({ ledger, navigate, onLogout, userEmail }) {
  const trashCount = new Set(ledger.transactions.filter((item) => item.deletedAt).map((item) => item.transferId ?? item.id)).size;
  const links = [
    ['/dashboard', 'chart', 'Dashboard', 'Gráficas de ingresos, gastos, categorías, patrimonio y cuentas'],
    ['/gestion', 'wallet', 'Gestión', 'Crear cuentas, tarjetas, créditos y gastos o ingresos frecuentes'],
    ['/deudas', 'card', 'Plan para salir de deudas', 'Avalancha vs. bola de nieve y % de tus ingresos en deudas'],
    ['/avisos', 'bell', 'Avisos', 'Pagos próximos, frecuentes registrados y alertas'],
    ['/ajustes', 'bell', 'Avisos y Telegram', 'Cuándo avisarte y conectar tu Telegram'],
    ['/categorias', 'tag', 'Categorías', 'Crear y ordenar tus categorías de ingresos y gastos'],
    ['/papelera', 'trash', 'Papelera', trashCount ? `${trashCount} movimiento(s) para restaurar o eliminar` : 'Vacía'],
    ['/historico', 'history', 'Histórico 2026 (app anterior)', 'Tus datos de enero a octubre, presupuesto y deudas, tal como estaban'],
  ];

  return (
    <div className="page">
      <div className="page-head"><h1>Más</h1></div>
      <ul className="menu-list">
        {links.map(([path, icon, title, hint]) => (
          <li key={path}>
            <button type="button" className="menu-item" onClick={() => navigate(path)}>
              <Icon name={icon} />
              <span><strong>{title}</strong><small>{hint}</small></span>
              <Icon name="chevronRight" size={18} />
            </button>
          </li>
        ))}
        <li>
          <button type="button" className="menu-item" onClick={onLogout}>
            <Icon name="logout" />
            <span><strong>Salir</strong><small>{userEmail}</small></span>
          </button>
        </li>
      </ul>
      <p className="form-hint">Próximamente aquí: presupuesto, metas, lista de compras, reportes y exportación al SRI.</p>
    </div>
  );
}

function CategorySheet({ kind, existing, onSave, onClose }) {
  const [name, setName] = useState(existing?.name ?? '');
  const [sriCategory, setSriCategory] = useState(existing?.sriCategory ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const categoryKind = existing?.kind ?? kind;

  async function submit(event) {
    event.preventDefault();
    if (!name.trim()) {
      setError('Escribe un nombre.');
      return;
    }
    setBusy(true);
    const saved = await onSave({ name, kind: categoryKind, sriCategory }, existing);
    setBusy(false);
    if (saved) onClose();
  }

  return (
    <Sheet
      title={existing ? 'Editar categoría' : `Nueva categoría de ${categoryKind === 'gasto' ? 'gasto' : 'ingreso'}`}
      size="sm"
      onClose={onClose}
      footer={(
        <>
          <span className="spacer" />
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="category-form" className="btn btn-primary" disabled={busy} aria-busy={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </>
      )}
    >
      <form id="category-form" className="form-stack" onSubmit={submit} noValidate>
        <Field label="Nombre" error={error}>
          {(props) => <input {...props} className="input" value={name} onChange={(event) => setName(event.target.value)} autoFocus disabled={existing?.isSystem} />}
        </Field>
        {categoryKind === 'gasto' && (
          <Field label="Categoría del SRI (gastos personales deducibles)" hint="Opcional. Sirve para la declaración de impuestos.">
            {(props) => (
              <select {...props} className="input" value={sriCategory} onChange={(event) => setSriCategory(event.target.value)}>
                <option value="">No deducible</option>
                {Object.entries(sriCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            )}
          </Field>
        )}
      </form>
    </Sheet>
  );
}

export function CategoriesPage({ ledger, navigate }) {
  const { categories, transactions, actions } = ledger;
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const usage = transactions.reduce((count, item) => ({ ...count, [item.categoryId]: (count[item.categoryId] ?? 0) + 1 }), {});

  return (
    <div className="page">
      <button type="button" className="back" onClick={() => navigate('/mas')}><Icon name="chevronLeft" size={18} /> Más</button>
      <div className="page-head"><h1>Categorías</h1></div>
      {['gasto', 'ingreso'].map((kind) => (
        <section key={kind} className="card" aria-labelledby={`cat-${kind}`}>
          <div className="card-head">
            <h2 id={`cat-${kind}`}>{kind === 'gasto' ? 'Gastos' : 'Ingresos'}</h2>
            <button type="button" className="btn btn-secondary btn-small" onClick={() => setEditing({ kind })}>
              <Icon name="plus" size={16} /> Nueva
            </button>
          </div>
          <ul className="category-list">
            {categories.filter((category) => category.kind === kind).map((category) => (
              <li key={category.id} className={category.archivedAt ? 'is-archived' : ''}>
                <span>
                  {category.name}
                  <small>
                    {[
                      category.sriCategory && `SRI: ${sriCategoryLabels[category.sriCategory]}`,
                      category.isSystem && 'Del sistema',
                      category.archivedAt && 'Archivada',
                      `${usage[category.id] ?? 0} movimiento(s)`,
                    ].filter(Boolean).join(' · ')}
                  </small>
                </span>
                <span className="row-actions">
                  <button type="button" className="link" onClick={() => setEditing({ kind, existing: category })} aria-label={`Editar ${category.name}`}>Editar</button>
                  {!category.isSystem && (
                    <button type="button" className="link" onClick={() => setConfirm(category)} aria-label={`${category.archivedAt ? 'Reactivar' : 'Archivar'} ${category.name}`}>
                      {category.archivedAt ? 'Reactivar' : 'Archivar'}
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {editing && <CategorySheet kind={editing.kind} existing={editing.existing} onSave={actions.saveCategory} onClose={() => setEditing(null)} />}
      {confirm && (
        <ConfirmDialog
          title={confirm.archivedAt ? '¿Reactivar la categoría?' : '¿Archivar la categoría?'}
          message={confirm.archivedAt ? 'Volverá a aparecer al registrar movimientos.' : 'Deja de aparecer al registrar movimientos. Los movimientos que ya la usan la conservan.'}
          confirmLabel={confirm.archivedAt ? 'Reactivar' : 'Archivar'}
          onConfirm={() => actions.archiveCategory(confirm, !confirm.archivedAt)}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

export function TrashPage({ ledger, navigate }) {
  const { transactions, accounts, categories, actions } = ledger;
  const [confirm, setConfirm] = useState(null);
  const accountsById = Object.fromEntries(accounts.map((account) => [account.id, account]));
  const categoriesById = Object.fromEntries(categories.map((category) => [category.id, category]));
  // Una transferencia borrada aparece una sola vez.
  const items = transactions.filter((item) => item.deletedAt && (!item.transferId || item.cents < 0));

  return (
    <div className="page">
      <button type="button" className="back" onClick={() => navigate('/mas')}><Icon name="chevronLeft" size={18} /> Más</button>
      <div className="page-head"><h1>Papelera</h1></div>
      <p className="form-hint">Los movimientos en la papelera no cuentan en tus saldos. Puedes restaurarlos o eliminarlos para siempre.</p>
      <section className="card">
        {items.length ? (
          <ul className="category-list">
            {items.map((item) => (
              <li key={item.id}>
                <span>
                  {item.description || categoriesById[item.categoryId]?.name || kindLabels[item.kind]} · {formatCents(Math.abs(item.cents))}
                  <small>{kindLabels[item.kind]} · {accountsById[item.accountId]?.name} · {item.date.split('-').reverse().join('/')}</small>
                </span>
                <span className="row-actions">
                  <button type="button" className="link" onClick={() => actions.restoreTransaction(item)}>Restaurar</button>
                  <button type="button" className="link link-danger" onClick={() => setConfirm(item)}>Eliminar</button>
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="empty">La papelera está vacía.</p>}
      </section>
      {confirm && (
        <ConfirmDialog
          title="¿Eliminar para siempre?"
          message="Esta acción no se puede deshacer. El movimiento queda solo en el historial de cambios."
          confirmLabel="Eliminar para siempre"
          danger
          onConfirm={() => actions.deleteForever(confirm)}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
