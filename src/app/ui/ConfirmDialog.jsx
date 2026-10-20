import { useState } from 'react';
import { Sheet } from './Sheet';

// altLabel/onAlt: segunda opción (por ejemplo "Solo este" frente a "Este y los siguientes").
export function ConfirmDialog({ title, message, confirmLabel = 'Confirmar', danger = false, onConfirm, altLabel, onAlt, onClose }) {
  const [busy, setBusy] = useState(false);

  async function confirm(action = onConfirm) {
    setBusy(true);
    const done = await action();
    setBusy(false);
    if (done !== false) onClose();
  }

  return (
    <Sheet
      title={title}
      size="sm"
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          {onAlt && (
            <button type="button" className={`btn ${danger ? 'btn-ghost-danger' : 'btn-secondary'}`} onClick={() => confirm(onAlt)} disabled={busy}>
              {altLabel}
            </button>
          )}
          <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => confirm()} disabled={busy} aria-busy={busy}>
            {busy ? 'Procesando…' : confirmLabel}
          </button>
        </>
      )}
    >
      <p className="confirm-message">{message}</p>
    </Sheet>
  );
}
