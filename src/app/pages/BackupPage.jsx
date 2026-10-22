import { useState } from 'react';
import { today } from '../../shared/lib/date';
import { monthKey, monthLabel, shiftMonth } from '../../shared/lib/ledger';
import { DateField } from '../ui/DateField';
import { Field } from '../ui/Field';
import { Icon } from '../ui/Icon';

// Respaldo en Excel: todos tus datos (cuentas, categorías, frecuentes, diferidos, créditos, metas y configuración)
// más los movimientos del período elegido: un día, un mes, un año, un rango o todo.

const modes = [['dia', 'Día'], ['mes', 'Mes'], ['anio', 'Año'], ['rango', 'Rango'], ['todo', 'Todo']];
const shortDate = (date) => date.split('-').reverse().join('/');

function lastDay(key) {
  const [year, month] = key.split('-').map(Number);
  return `${key}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
}

export function BackupPage({ ledger, navigate }) {
  const day = today();
  const firstYear = Math.min(Number(day.slice(0, 4)), ...ledger.transactions.map((transaction) => Number(transaction.date.slice(0, 4))));
  const years = Array.from({ length: Number(day.slice(0, 4)) - firstYear + 1 }, (_, index) => Number(day.slice(0, 4)) - index);
  const months = Array.from({ length: 24 }, (_, index) => shiftMonth(monthKey(day), -index));
  const [mode, setMode] = useState('mes');
  const [date, setDate] = useState(day);
  const [month, setMonth] = useState(monthKey(day));
  const [year, setYear] = useState(Number(day.slice(0, 4)));
  const [from, setFrom] = useState(`${day.slice(0, 7)}-01`);
  const [to, setTo] = useState(day);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const period = {
    dia: { from: date, to: date, label: `Día ${date ? shortDate(date) : ''}` },
    mes: { from: `${month}-01`, to: lastDay(month), label: monthLabel(month) },
    anio: { from: `${year}-01-01`, to: `${year}-12-31`, label: `Año ${year}` },
    rango: { from, to, label: from && to ? `Del ${shortDate(from)} al ${shortDate(to)}` : 'Rango' },
    todo: { from: null, to: null, label: 'Todo' },
  }[mode];
  const count = ledger.transactions.filter((transaction) => (!period.from || transaction.date >= period.from) && (!period.to || transaction.date <= period.to)).length;
  const invalid = (mode === 'dia' && !date) || (mode === 'rango' && (!from || !to || from > to));

  async function download() {
    setBusy(true);
    setError('');
    try {
      const { exportBackup } = await import('../../shared/lib/exportReports');
      exportBackup(ledger, period);
    } catch {
      setError('No se pudo generar el archivo. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <button type="button" className="back" onClick={() => navigate('/mas')}><Icon name="chevronLeft" size={18} /> Más</button>
      <div className="page-head"><h1>Respaldo</h1></div>

      <section className="card" aria-labelledby="backup-title">
        <div className="card-head"><h2 id="backup-title">Descargar en Excel</h2></div>
        <p className="form-hint">
          El archivo trae todas tus cuentas, categorías, frecuentes, diferidos, créditos, estados de cuenta, metas, valores del SRI y ajustes,
          más los movimientos del período que elijas (incluidos los de la papelera). Se guarda en tu dispositivo y pesa poco.
        </p>

        <div className="chips" role="tablist" aria-label="Período de los movimientos">
          {modes.map(([value, label]) => (
            <button key={value} type="button" role="tab" aria-selected={mode === value} className={`chip ${mode === value ? 'is-active' : ''}`} onClick={() => setMode(value)}>
              {label}
            </button>
          ))}
        </div>

        {mode === 'dia' && (
          <Field label="Día">{(props) => <DateField {...props} value={date} onChange={setDate} />}</Field>
        )}
        {mode === 'mes' && (
          <Field label="Mes">
            {(props) => (
              <select {...props} className="input" value={month} onChange={(event) => setMonth(event.target.value)}>
                {months.map((key) => <option key={key} value={key}>{monthLabel(key)}</option>)}
              </select>
            )}
          </Field>
        )}
        {mode === 'anio' && (
          <Field label="Año">
            {(props) => (
              <select {...props} className="input" value={year} onChange={(event) => setYear(Number(event.target.value))}>
                {years.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            )}
          </Field>
        )}
        {mode === 'rango' && (
          <div className="field-row">
            <Field label="Desde">{(props) => <DateField {...props} value={from} onChange={setFrom} shortcuts={false} />}</Field>
            <Field label="Hasta" error={from && to && from > to ? 'Debe ser después de "Desde".' : ''}>{(props) => <DateField {...props} value={to} onChange={setTo} shortcuts={false} />}</Field>
          </div>
        )}

        <p className="form-hint" role="status">{period.label}: {count} movimiento(s) en el período.</p>
        {error && <p className="field-error" role="alert">{error}</p>}
        <button type="button" className="btn btn-primary justify-self-start" onClick={download} disabled={busy || invalid} aria-busy={busy}>
          {busy ? 'Preparando…' : 'Descargar respaldo'}
        </button>
      </section>
    </div>
  );
}
