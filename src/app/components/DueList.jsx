import { formatCents } from '../../shared/lib/cents';
import { formatDayLabel } from '../../shared/lib/ledger';

function dueLabel({ date, overdue, isToday }) {
  if (isToday) return 'Hoy';
  const label = formatDayLabel(date);
  return overdue ? `Venció ${label.toLowerCase()}` : label;
}

// Frecuentes pendientes de registrar (vencidos y próximos), con un botón para registrarlos.
export function DueList({ due, onRegister, limit }) {
  const items = limit ? due.slice(0, limit) : due;
  if (!items.length) return <p className="empty">No tienes pagos ni ingresos frecuentes pendientes.</p>;

  return (
    <ul className="due-list">
      {items.map((occurrence) => (
        <li key={`${occurrence.item.id}:${occurrence.date}`} className={occurrence.overdue ? 'is-overdue' : ''}>
          <span className="due-text">
            <strong>{occurrence.item.name}</strong>
            <small>{dueLabel(occurrence)}</small>
          </span>
          <span className={`amount ${occurrence.item.kind === 'ingreso' ? 'amount-positive' : occurrence.item.kind === 'gasto' ? 'amount-negative' : 'amount-zero'}`}>
            {formatCents(occurrence.item.cents)}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => onRegister(occurrence)}
            aria-label={`Registrar ${occurrence.item.name} del ${occurrence.date.split('-').reverse().join('/')}`}
          >
            Registrar
          </button>
        </li>
      ))}
    </ul>
  );
}
