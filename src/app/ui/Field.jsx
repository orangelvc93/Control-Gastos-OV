import { useId } from 'react';
import { formatCents } from '../../shared/lib/cents';

// Campo con etiqueta visible y mensaje de error asociado (aria-describedby).
export function Field({ label, error, hint, children, className = '' }) {
  const id = useId();
  const messageId = `${id}-message`;
  const control = typeof children === 'function'
    ? children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': error || hint ? messageId : undefined })
    : children;

  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      {control}
      {(error || hint) && <small id={messageId} className={error ? 'field-error' : 'field-hint'}>{error || hint}</small>}
    </div>
  );
}

// Deuda de tarjeta: se muestra en positivo ("debes 120,00") pero en tono de alerta.
export function DebtAmount({ balanceCents }) {
  const debt = -balanceCents;
  return <span className={`amount ${debt > 0 ? 'amount-negative' : 'amount-zero'}`}>{formatCents(debt)}</span>;
}

export function Amount({ cents, signed = false, className = '' }) {
  const tone = cents > 0 ? 'positive' : cents < 0 ? 'negative' : 'zero';
  const text = signed && cents > 0 ? `+${formatCents(cents)}` : formatCents(cents);
  return <span className={`amount amount-${tone} ${className}`}>{text}</span>;
}
