export function LoadingOverlay() {
  return (
    <div className="loading-backdrop" role="status" aria-live="polite" aria-label="Procesando">
      <div className="loading-card">
        <span className="loading-spinner" />
        <strong>Procesando...</strong>
      </div>
    </div>
  );
}
