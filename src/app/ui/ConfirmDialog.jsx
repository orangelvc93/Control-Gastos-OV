import { useState } from 'react';
import { Sheet } from './Sheet';

export function ConfirmDialog({ title, message, confirmLabel = 'Confirmar', danger = false, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    const done = await onConfirm();
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
          <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={confirm} disabled={busy} aria-busy={busy}>
            {busy ? 'Procesando…' : confirmLabel}
          </button>
        </>
      )}
    >
      <p className="confirm-message">{message}</p>
    </Sheet>
  );
}
