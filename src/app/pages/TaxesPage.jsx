import { useState } from 'react';
import { centsToInput, formatCents, parseAmountInput } from '../../shared/lib/cents';
import { today } from '../../shared/lib/date';
import { taxIncomeLabels } from '../../shared/lib/ledger';
import { basketsAllowed, debtsAtYearEnd, incomeByType, personalExpensesSummary, taxConfig } from '../../shared/lib/taxes';
import { DateField } from '../ui/DateField';
import { Field } from '../ui/Field';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';

// Impuestos (SRI): gastos personales deducibles, facturas por completar, ingresos por tipo y exportación.
// Cálculos en shared/lib/taxes.js; los valores del SRI son editables por año y hay que verificarlos.

const shortDate = (date) => date.split('-').reverse().join('/');

function ProgressBar({ value, tone = 'normal' }) {
  return (
    <span className={`progress progress-${tone}`} aria-hidden="true">
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </span>
  );
}

export function TaxesPage({ ledger, navigate, onSelectTransaction }) {
  const currentYear = Number(today().slice(0, 4));
  const years = [...new Set([currentYear, currentYear - 1, ...ledger.taxYears.map((item) => item.year)])].sort((a, b) => b - a);
  const [year, setYear] = useState(currentYear);
  const [editing, setEditing] = useState(false);
  const config = taxConfig(ledger.taxYears, year);
  const summary = personalExpensesSummary(ledger, config);
  const income = incomeByType(ledger, config);
  const debts = debtsAtYearEnd(ledger, year);
  const [from, setFrom] = useState(`${currentYear}-01-01`);
  const [to, setTo] = useState(today());
  const [exporting, setExporting] = useState('');

  async function exportFile(kind) {
    setExporting(kind);
    try {
      const module = await import('../../shared/lib/exportReports');
      if (kind === 'sri') module.exportSriReport(ledger, config);
      else module.exportRangeReport(ledger, from, to);
    } finally {
      setExporting('');
    }
  }

  return (
    <div className="page page-split min-[1100px]:grid-cols-2 min-[1100px]:items-start">
      <button type="button" className="back min-[1100px]:col-span-2" onClick={() => navigate('/mas')}><Icon name="chevronLeft" size={18} /> Más</button>
      <div className="page-head min-[1100px]:col-span-2">
        <h1>Impuestos</h1>
        <select className="input max-w-36" value={year} onChange={(event) => setYear(Number(event.target.value))} aria-label="Año fiscal">
          {years.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </div>

      <p className="alert alert-warning min-[1100px]:col-span-2" role="status">
        Los valores del SRI cambian cada año. {config.saved ? 'Revisa' : 'Estos son valores de partida: revisa'} los de {year} con la normativa vigente antes de declarar.{' '}
        <button type="button" className="link" onClick={() => setEditing(true)}>Valores del SRI {year}</button>
      </p>

      <section className="card" aria-labelledby="tax-expenses">
        <div className="card-head"><h2 id="tax-expenses">Gastos personales {year}</h2></div>
        <dl className="figures">
          <div><dt>Deducibles registrados</dt><dd>{formatCents(summary.total)}</dd></div>
          <div><dt>Tope ({summary.baskets} canastas)</dt><dd>{summary.cap === null ? '—' : formatCents(summary.cap)}</dd></div>
          <div><dt>Rebaja estimada ({config.rebatePct} %)</dt><dd>{formatCents(summary.rebate)}</dd></div>
        </dl>
        {summary.cap !== null && <ProgressBar value={(summary.total / summary.cap) * 100} tone={summary.total >= summary.cap ? 'good' : 'normal'} />}
        <p className="form-hint">
          La rebaja es el {config.rebatePct} % del menor valor entre tus gastos personales y el tope
          {summary.cap !== null ? ` (${summary.baskets} canastas × ${formatCents(config.basketCents)})` : ''}. Se resta del impuesto a la renta.
          {summary.cap !== null && summary.total >= summary.cap ? ' Ya llegaste al tope: más gastos no aumentan la rebaja.' : ''}
        </p>
        <ul className="category-list">
          {summary.byCategory.map((row) => (
            <li key={row.key}>
              <span>{row.label}<small>{row.count} gasto(s)</small></span>
              <strong>{formatCents(row.cents)}</strong>
            </li>
          ))}
        </ul>
        {summary.withoutCategory.length > 0 && (
          <p className="form-hint">
            {summary.withoutCategory.length} gasto(s) marcados deducibles no tienen categoría del SRI y no suman: asígnala a su categoría en Más → Categorías.
          </p>
        )}
      </section>

      <section className="card" aria-labelledby="tax-incomplete">
        <div className="card-head">
          <h2 id="tax-incomplete">Facturas por completar</h2>
          {summary.incomplete.length > 0 && <span className="pill pill-pending">{summary.incomplete.length}</span>}
        </div>
        {summary.incomplete.length ? (
          <>
            <p className="form-hint">Gastos deducibles sin RUC o sin número de factura. Tócalos para completarlos.</p>
            <ul className="category-list">
              {summary.incomplete.slice(0, 20).map(({ transaction, cents }) => (
                <li key={transaction.id}>
                  <span>
                    {transaction.description || 'Gasto'}
                    <small>{shortDate(transaction.date)} · falta {[!transaction.invoice.ruc && 'RUC', !transaction.invoice.number && 'número'].filter(Boolean).join(' y ')}</small>
                  </span>
                  <span className="row-actions">
                    <strong>{formatCents(cents)}</strong>
                    <button type="button" className="link" onClick={() => onSelectTransaction(transaction)}>Completar</button>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="empty">Todas tus facturas deducibles de {year} tienen RUC y número.</p>
        )}
      </section>

      <section className="card" aria-labelledby="tax-income">
        <div className="card-head"><h2 id="tax-income">Ingresos {year} por tipo</h2></div>
        {income.groups.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th scope="col">Tipo</th><th scope="col">Recibido</th><th scope="col">Bruto</th></tr></thead>
              <tbody>
                {income.groups.map((group) => (
                  <tr key={group.type}>
                    <td>{taxIncomeLabels[group.type] ?? 'Sin tipo asignado'}</td>
                    <td>{formatCents(group.netCents)}</td>
                    <td>{formatCents(group.grossCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">Sin ingresos registrados en {year}.</p>
        )}
        <p className="form-hint">
          El tipo sale de la categoría (Más → Categorías). Los intereses se anotan netos: el bruto se reconstruye con el % de retención
          ({config.interestWithholdingPct} % o el de cada cuenta). Retención estimada: {formatCents(income.withheldCents)}.
        </p>
      </section>

      <section className="card" aria-labelledby="tax-debts">
        <div className="card-head"><h2 id="tax-debts">Deudas al 31 de diciembre</h2></div>
        {debts.length ? (
          <ul className="category-list">
            {debts.map((row) => (
              <li key={row.account.id}>
                <span>{row.account.name}<small>Intereses pagados en {year}: {formatCents(row.interestCents)}</small></span>
                <strong>{formatCents(row.debtCents)}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">Sin deudas en {year}.</p>
        )}
        <p className="form-hint">Por si las necesitas para la declaración patrimonial.</p>
      </section>

      <section className="card min-[1100px]:col-span-2" aria-labelledby="tax-export">
        <div className="card-head"><h2 id="tax-export">Reportes en Excel</h2></div>
        <div className="grid gap-3 min-[900px]:grid-cols-2">
          <div className="grid content-start gap-2">
            <strong>Para el SRI · {year}</strong>
            <p className="form-hint m-0">Gastos personales con el detalle de cada factura, ingresos por tipo, retenciones y deudas al 31/12.</p>
            <button type="button" className="btn btn-primary justify-self-start" onClick={() => exportFile('sri')} disabled={Boolean(exporting)} aria-busy={exporting === 'sri'}>
              {exporting === 'sri' ? 'Preparando…' : `Descargar Excel del SRI ${year}`}
            </button>
          </div>
          <div className="grid content-start gap-2">
            <strong>Movimientos y resumen por fechas</strong>
            <div className="field-row">
              <Field label="Desde">{(props) => <DateField {...props} value={from} onChange={setFrom} shortcuts={false} />}</Field>
              <Field label="Hasta">{(props) => <DateField {...props} value={to} onChange={setTo} shortcuts={false} />}</Field>
            </div>
            <button type="button" className="btn btn-secondary justify-self-start" onClick={() => exportFile('rango')} disabled={Boolean(exporting) || !from || !to || from > to} aria-busy={exporting === 'rango'}>
              {exporting === 'rango' ? 'Preparando…' : 'Descargar Excel'}
            </button>
          </div>
        </div>
      </section>

      {editing && <TaxYearSheet config={config} onSave={ledger.actions.saveTaxYear} onClose={() => setEditing(false)} />}
    </div>
  );
}

// Valores del SRI de un año: se guardan por usuario y año; nada queda fijo en el código.
function TaxYearSheet({ config, onSave, onClose }) {
  const money = (cents) => (cents === null || cents === undefined ? '' : centsToInput(cents));
  const [form, setForm] = useState({
    basicFraction: money(config.basicFractionCents),
    basket: money(config.basketCents),
    rebatePct: String(config.rebatePct),
    dependents: String(config.dependents),
    catastrophic: config.catastrophic,
    interestWithholdingPct: String(config.interestWithholdingPct),
    limits: Object.fromEntries(Object.entries(config.basketLimits).map(([key, value]) => [key, String(value)])),
    catastrophicBaskets: String(config.catastrophicBaskets),
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const update = (patch) => setForm((current) => ({ ...current, ...patch }));
  const number = (text) => Number(String(text).replace(',', '.'));

  async function submit(event) {
    event.preventDefault();
    const values = {
      year: config.year,
      basicFractionCents: form.basicFraction.trim() ? parseAmountInput(form.basicFraction) : null,
      basketCents: form.basket.trim() ? parseAmountInput(form.basket) : null,
      rebatePct: number(form.rebatePct),
      dependents: Math.round(number(form.dependents)),
      catastrophic: form.catastrophic,
      basketLimits: Object.fromEntries(Object.entries(form.limits).map(([key, value]) => [key, Math.round(number(value))])),
      catastrophicBaskets: Math.round(number(form.catastrophicBaskets)),
      interestWithholdingPct: number(form.interestWithholdingPct),
    };
    const bad = [values.basicFractionCents, values.basketCents].some((value) => value !== null && !Number.isFinite(value))
      || !(values.rebatePct >= 0 && values.rebatePct <= 100) || !(values.dependents >= 0 && values.dependents <= 20)
      || !(values.interestWithholdingPct >= 0 && values.interestWithholdingPct < 100)
      || Object.values(values.basketLimits).some((value) => !(value >= 0)) || !(values.catastrophicBaskets >= 0);
    if (bad) return setError('Revisa los valores: montos válidos, porcentajes entre 0 y 100 y canastas en números enteros.');
    setBusy(true);
    const saved = await onSave(values);
    setBusy(false);
    if (saved) onClose();
  }

  const preview = basketsAllowed({ ...config, dependents: Math.round(number(form.dependents)) || 0, catastrophic: form.catastrophic, basketLimits: form.limits, catastrophicBaskets: number(form.catastrophicBaskets) });

  return (
    <Sheet
      title={`Valores del SRI ${config.year}`}
      onClose={onClose}
      footer={(
        <>
          <span className="spacer" />
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="tax-year-form" className="btn btn-primary" disabled={busy} aria-busy={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </>
      )}
    >
      <form id="tax-year-form" className="form-stack" onSubmit={submit} noValidate>
        <p className="alert alert-warning">Verifica estos valores con el SRI: cambian cada año y la app no los actualiza sola.</p>
        <div className="field-row">
          <Field label="Fracción básica desgravada (USD)" hint="Informativa: la base exenta del impuesto a la renta.">
            {(props) => <input {...props} className="input" inputMode="decimal" value={form.basicFraction} onChange={(event) => update({ basicFraction: event.target.value })} />}
          </Field>
          <Field label="Canasta familiar básica (USD)" hint="La de enero del año fiscal.">
            {(props) => <input {...props} className="input" inputMode="decimal" value={form.basket} onChange={(event) => update({ basket: event.target.value })} />}
          </Field>
        </div>
        <div className="field-row">
          <Field label="Rebaja por gastos personales (%)">
            {(props) => <input {...props} className="input" inputMode="decimal" value={form.rebatePct} onChange={(event) => update({ rebatePct: event.target.value })} />}
          </Field>
          <Field label="Retención en intereses (%)" hint="Si la cuenta tiene su propio %, se usa ese.">
            {(props) => <input {...props} className="input" inputMode="decimal" value={form.interestWithholdingPct} onChange={(event) => update({ interestWithholdingPct: event.target.value })} />}
          </Field>
        </div>
        <div className="field-row">
          <Field label="Cargas familiares" hint="Padres, cónyuge e hijos que dependan de ti.">
            {(props) => <input {...props} className="input" inputMode="numeric" value={form.dependents} onChange={(event) => update({ dependents: event.target.value })} />}
          </Field>
          <label className="check self-end">
            <input type="checkbox" checked={form.catastrophic} onChange={(event) => update({ catastrophic: event.target.checked })} />
            <span>Enfermedad catastrófica, rara o huérfana (tú o una carga)</span>
          </label>
        </div>
        <fieldset className="fieldset">
          <legend>Canastas permitidas según cargas familiares</legend>
          <div className="grid grid-cols-3 gap-2 min-[640px]:grid-cols-7">
            {Object.keys(form.limits).sort().map((key) => (
              <Field key={key} label={key === '5' ? '5 o más' : `${key} carga${key === '1' ? '' : 's'}`}>
                {(props) => <input {...props} className="input" inputMode="numeric" value={form.limits[key]} onChange={(event) => update({ limits: { ...form.limits, [key]: event.target.value } })} />}
              </Field>
            ))}
            <Field label="Catastrófica">
              {(props) => <input {...props} className="input" inputMode="numeric" value={form.catastrophicBaskets} onChange={(event) => update({ catastrophicBaskets: event.target.value })} />}
            </Field>
          </div>
          <p className="form-hint m-0">Con estos valores te corresponden {preview} canastas.</p>
        </fieldset>
        {error && <p className="field-error" role="alert">{error}</p>}
      </form>
    </Sheet>
  );
}
