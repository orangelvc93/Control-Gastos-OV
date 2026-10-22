import { useState } from 'react';
import { centsToInput, formatCents, parseAmountInput } from '../../shared/lib/cents';

// Ingreso mensual usado en el plan de deudas y en el presupuesto: el anotado o el promedio de los últimos meses.
export function IncomeEditor({ income, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(income.cents ? centsToInput(income.cents) : '');
  const sourceText = {
    anotado: 'lo anotaste tú',
    promedio: `promedio de tus ingresos de los últimos ${income.months} mes(es)`,
    'este-mes': 'ingresos de este mes',
    'sin-datos': 'aún no hay ingresos registrados',
  }[income.source];

  if (!editing) {
    return (
      <span className="stat-hint">
        Ingreso mensual {formatCents(income.cents)} ({sourceText}) ·{' '}
        <button type="button" className="link" onClick={() => setEditing(true)}>cambiar</button>
      </span>
    );
  }

  return (
    <form
      className="inline-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const cents = value.trim() === '' ? null : parseAmountInput(value);
        if (cents !== null && !Number.isFinite(cents)) return;
        if (await onSave(cents)) setEditing(false);
      }}
    >
      <input className="input" inputMode="decimal" aria-label="Ingreso mensual" placeholder="Vacío = promedio" value={value} onChange={(event) => setValue(event.target.value)} />
      <button type="submit" className="btn btn-primary btn-small">Guardar</button>
    </form>
  );
}
