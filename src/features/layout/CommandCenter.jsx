import { Button } from "../../shared/ui/Button";
import { Select } from "../../shared/ui/FormControls";
import { startHelpTour } from "../../shared/lib/tour";

export function CommandCenter({
  activeYear,
  createYear,
  exportExcel,
  resetData,
  setActiveYear,
  syncStatus,
  years,
}) {
  return (
    <header className="command-center" data-tour="header">
      <span className="sync-badge">{syncStatus}</span>
      <div>
        <p className="eyebrow">Libro financiero {activeYear}</p>
        <h1>Control de gastos</h1>
        <p>
          Panel operativo conectado a Supabase para pagos, ingresos, ahorros,
          cuotas y presupuesto.
        </p>
      </div>
      <div className="command-actions">
        <div className="year-controls">
          <Select
            value={activeYear}
            onChange={(event) => setActiveYear(event.target.value)}
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </Select>
          <Button variant="secondary" onClick={createYear}>
            Nuevo año
          </Button>
        </div>
        <Button variant="secondary" data-tour="help" onClick={startHelpTour}>
          Ayuda
        </Button>
        <Button variant="secondary" onClick={exportExcel}>Exportar Excel</Button>
        <Button onClick={resetData}>Restaurar datos iniciales</Button>
      </div>
    </header>
  );
}
