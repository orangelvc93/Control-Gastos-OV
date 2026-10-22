import { useEffect, useId, useRef } from 'react';
import { Icon } from './Icon';

// Usa <dialog> nativo: atrapa el foco, cierra con Escape y devuelve el foco al cerrar.
// En el celular aparece como hoja desde abajo; en pantallas grandes, centrado.
export function Sheet({ title, children, footer, onClose, size = 'md' }) {
  const ref = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
      // showModal() enfoca el primer botón (Cerrar); se pasa al campo marcado con data-autofocus.
      dialog.querySelector('[data-autofocus]')?.focus();
    }
    return () => dialog?.open && dialog.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className={`sheet sheet-${size}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="sheet-panel">
        <header className="sheet-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-footer">{footer}</footer>}
      </div>
    </dialog>
  );
}
