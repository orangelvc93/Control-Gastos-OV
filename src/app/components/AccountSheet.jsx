import { useState } from 'react';
import { centsToInput, formatCents, parseAmountInput } from '../../shared/lib/cents';
import { today } from '../../shared/lib/date';
import { accountTypeLabels } from '../../shared/lib/ledger';
import { DateField } from '../ui/DateField';
import { Field } from '../ui/Field';
import { Sheet } from '../ui/Sheet';

const interestTypes = ['ahorro', 'inversion', 'poliza'];
// Plazos de diferido con intereses que suelen traer los estados de cuenta (factor = interés total del diferido).
const FACTOR_MONTHS = [3, 6, 9, 12, 18, 24, 36, 48];

function factorsToForm(factors = {}) {
  return Object.fromEntries(FACTOR_MONTHS.map((months) => [months, factors[months] ? String(factors[months]).replace('.', ',') : '']));
}

function initialValues(existing, presetType = 'ahorro') {
  if (!existing) {
    return {
      name: '', institution: '', type: presetType, opening: '', openingNegative: false, openingDate: today(),
      isSavings: presetType === 'inversion' || presetType === 'poliza',
      creditLimit: '', statementDay: '', dueDay: '', interestRate: '', rateType: 'nominal', dayBasis: '360', capitalizes: true, minPaymentPct: '10',
      deferralFactors: factorsToForm(),
    };
  }
  const isCardAccount = existing.type === 'tarjeta_credito';
  return {
    name: existing.name,
    institution: existing.institution,
    type: existing.type,
    // En tarjetas se pide la deuda en positivo; se guarda como saldo negativo.
    opening: centsToInput(isCardAccount ? -existing.openingCents : existing.openingCents),
    openingNegative: !isCardAccount && existing.openingCents < 0,
    openingDate: existing.openingDate,
    isSavings: existing.isSavings,
    creditLimit: existing.creditLimitCents === null ? '' : centsToInput(existing.creditLimitCents),
    statementDay: existing.statementDay ?? '',
    dueDay: existing.dueDay ?? '',
    interestRate: existing.interestRate ?? '',
    rateType: existing.rateType ?? 'nominal',
    dayBasis: String(existing.dayBasis ?? 360),
    capitalizes: existing.capitalizes,
    minPaymentPct: String(existing.minPaymentPct ?? 10),
    deferralFactors: factorsToForm(existing.deferralFactors),
  };
}

export function AccountSheet({ existing, presetType, onSave, onClose }) {
  const [form, setForm] = useState(() => initialValues(existing, presetType));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [showInterest, setShowInterest] = useState(Boolean(existing?.interestRate || Object.keys(existing?.deferralFactors ?? {}).length));
  const update = (patch) => setForm((current) => ({ ...current, ...patch }));
  const isCardAccount = form.type === 'tarjeta_credito';
  // En tarjetas la tasa sirve para los diferidos con intereses y para estimar el interés si no pagas el total.
  const allowsInterest = interestTypes.includes(form.type) || isCardAccount;

  function changeType(type) {
    update({ type, isSavings: type === 'inversion' || type === 'poliza' ? true : form.isSavings });
  }

  async function submit(event) {
    event.preventDefault();
    const next = {};
    const opening = form.opening === '' ? 0 : parseAmountInput(form.opening);
    const creditLimit = form.creditLimit === '' ? null : parseAmountInput(form.creditLimit);
    const day = (value) => (value === '' ? null : Number(value));
    if (!form.name.trim()) next.name = 'Ponle un nombre a la cuenta.';
    if (!form.openingDate) next.openingDate = 'Escribe una fecha válida (dd/mm/aaaa).';
    if (!Number.isFinite(opening)) next.opening = 'Monto no válido. Ejemplo: 1.250,40';
    if (creditLimit !== null && !Number.isFinite(creditLimit)) next.creditLimit = 'Cupo no válido.';
    for (const key of ['statementDay', 'dueDay']) {
      const value = day(form[key]);
      if (value !== null && !(Number.isInteger(value) && value >= 1 && value <= 31)) next[key] = 'Día entre 1 y 31.';
    }
    if (form.interestRate !== '' && !(Number(String(form.interestRate).replace(',', '.')) >= 0)) next.interestRate = 'Tasa no válida.';
    const minPaymentPct = Number(String(form.minPaymentPct).replace(',', '.'));
    if (isCardAccount && !(minPaymentPct >= 0 && minPaymentPct <= 100)) next.minPaymentPct = 'Entre 0 y 100.';
    const deferralFactors = {};
    for (const months of FACTOR_MONTHS) {
      const text = String(form.deferralFactors[months] ?? '').trim();
      if (!text) continue;
      const value = Number(text.replace(',', '.'));
      if (value > 0 && value < 100) deferralFactors[months] = value;
      else next.deferralFactors = `Factor no válido a ${months} meses (ejemplo: 8,76).`;
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    const openingCents = isCardAccount ? -opening : form.openingNegative ? -opening : opening;
    setBusy(true);
    const saved = await onSave({
      name: form.name,
      institution: form.institution,
      type: form.type,
      openingCents,
      openingDate: form.openingDate,
      isSavings: !isCardAccount && form.isSavings,
      creditLimitCents: isCardAccount ? creditLimit : null,
      statementDay: isCardAccount ? day(form.statementDay) : null,
      dueDay: isCardAccount ? day(form.dueDay) : null,
      interestRate: allowsInterest && form.interestRate !== '' ? Number(String(form.interestRate).replace(',', '.')) : null,
      rateType: allowsInterest && form.interestRate !== '' ? form.rateType : null,
      dayBasis: allowsInterest && form.interestRate !== '' ? form.dayBasis : null,
      capitalizes: form.capitalizes,
      minPaymentPct: isCardAccount ? minPaymentPct : 10,
      deferralFactors: isCardAccount ? deferralFactors : {},
      color: existing?.color,
    }, existing);
    setBusy(false);
    if (saved) onClose();
  }

  return (
    <Sheet
      title={existing ? 'Editar cuenta' : 'Nueva cuenta'}
      onClose={onClose}
      footer={(
        <>
          <span className="spacer" />
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="account-form" className="btn btn-primary" disabled={busy} aria-busy={busy}>
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      )}
    >
      <form id="account-form" className="form-stack" onSubmit={submit} noValidate>
        <Field label="Nombre" error={errors.name}>
          {(props) => <input {...props} className="input" placeholder="Ej. Pichincha Ahorros" value={form.name} onChange={(event) => update({ name: event.target.value })} autoFocus={!existing} />}
        </Field>
        <div className="field-row">
          <Field label="Banco o institución">
            {(props) => <input {...props} className="input" value={form.institution} onChange={(event) => update({ institution: event.target.value })} />}
          </Field>
          <Field label="Tipo">
            {(props) => (
              <select {...props} className="input" value={form.type} onChange={(event) => changeType(event.target.value)}>
                {/* Los créditos se crean desde Gestión (tienen tasa, plazo y cuotas). */}
                {Object.entries(accountTypeLabels).filter(([value]) => value !== 'prestamo' || form.type === 'prestamo').map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            )}
          </Field>
        </div>

        <div className="field-row">
          <Field
            label={isCardAccount ? 'Deuda al empezar' : 'Saldo al empezar'}
            error={errors.opening}
            hint={existing ? 'Para corregir el saldo de hoy usa "Ajustar saldo" en la cuenta.' : 'El saldo que tiene hoy la cuenta.'}
          >
            {(props) => <input {...props} className="input" inputMode="decimal" placeholder="0,00" value={form.opening} onChange={(event) => update({ opening: event.target.value })} />}
          </Field>
          <Field label="Desde la fecha" error={errors.openingDate}>
            {(props) => <DateField {...props} value={form.openingDate} onChange={(openingDate) => update({ openingDate })} />}
          </Field>
        </div>
        {!isCardAccount && (
          <label className="check">
            <input type="checkbox" checked={form.openingNegative} onChange={(event) => update({ openingNegative: event.target.checked })} />
            <span>El saldo inicial es negativo (sobregiro)</span>
          </label>
        )}

        {!isCardAccount && (
          <label className="check">
            <input type="checkbox" checked={form.isSavings} onChange={(event) => update({ isSavings: event.target.checked })} />
            <span>Es un ahorro: no la uso para el día a día (cuenta en "Ahorros", no en "Disponible")</span>
          </label>
        )}

        {isCardAccount && (
          <div className="field-row field-row-3">
            <Field label="Cupo total" error={errors.creditLimit}>
              {(props) => <input {...props} className="input" inputMode="decimal" value={form.creditLimit} onChange={(event) => update({ creditLimit: event.target.value })} />}
            </Field>
            <Field label="Día de corte" error={errors.statementDay}>
              {(props) => <input {...props} className="input" inputMode="numeric" value={form.statementDay} onChange={(event) => update({ statementDay: event.target.value })} />}
            </Field>
            <Field label="Día máximo de pago" error={errors.dueDay}>
              {(props) => <input {...props} className="input" inputMode="numeric" value={form.dueDay} onChange={(event) => update({ dueDay: event.target.value })} />}
            </Field>
          </div>
        )}
        {isCardAccount && (
          <Field label="Pago mínimo estimado (% de lo que debes pagar)" error={errors.minPaymentPct} hint="Se usa solo si no anotas el mínimo de tu estado de cuenta.">
            {(props) => <input {...props} className="input" inputMode="decimal" value={form.minPaymentPct} onChange={(event) => update({ minPaymentPct: event.target.value })} />}
          </Field>
        )}

        {allowsInterest && (showInterest ? (
          <fieldset className="fieldset">
            <legend>{isCardAccount ? 'Tasa de la tarjeta' : 'Intereses'}</legend>
            <div className="field-row">
              <Field label="Tasa anual (%)" error={errors.interestRate}>
                {(props) => <input {...props} className="input" inputMode="decimal" value={form.interestRate} onChange={(event) => update({ interestRate: event.target.value })} />}
              </Field>
              <Field label="Tipo de tasa">
                {(props) => (
                  <select {...props} className="input" value={form.rateType} onChange={(event) => update({ rateType: event.target.value })}>
                    <option value="nominal">Nominal</option>
                    <option value="efectiva">Efectiva anual</option>
                  </select>
                )}
              </Field>
              <Field label="Días del año">
                {(props) => (
                  <select {...props} className="input" value={form.dayBasis} onChange={(event) => update({ dayBasis: event.target.value })}>
                    <option value="360">360</option>
                    <option value="365">365</option>
                  </select>
                )}
              </Field>
            </div>
            {isCardAccount ? (
              <>
                <p className="form-hint">La tasa anual que cobra la tarjeta (está en tu estado de cuenta). Se usa para estimar cuánto cuesta no pagar el total y en diferidos a plazos sin factor.</p>
                <p className="form-hint"><strong>Factores de diferido con intereses</strong> (sección "Crédito diferido" de tu estado de cuenta): interés total del diferido según el plazo.</p>
                <div className="factor-grid">
                  {FACTOR_MONTHS.map((months) => (
                    <Field key={months} label={`${months} meses (%)`}>
                      {(props) => (
                        <input
                          {...props}
                          className="input"
                          inputMode="decimal"
                          placeholder="—"
                          value={form.deferralFactors[months]}
                          onChange={(event) => update({ deferralFactors: { ...form.deferralFactors, [months]: event.target.value } })}
                        />
                      )}
                    </Field>
                  ))}
                </div>
                {errors.deferralFactors && <p className="field-error" role="alert">{errors.deferralFactors}</p>}
              </>
            ) : (
              <label className="check">
                <input type="checkbox" checked={form.capitalizes} onChange={(event) => update({ capitalizes: event.target.checked })} />
                <span>El interés se suma a esta misma cuenta</span>
              </label>
            )}
          </fieldset>
        ) : (
          <button type="button" className="link" onClick={() => setShowInterest(true)}>{isCardAccount ? '+ Agregar tasa y factores de diferido' : '+ Agregar tasa de interés'}</button>
        ))}
      </form>
    </Sheet>
  );
}

export function AdjustBalanceSheet({ account, currentCents, onSave, onClose }) {
  const isCardAccount = account.type === 'tarjeta_credito';
  const shown = isCardAccount ? -currentCents : currentCents;
  const [value, setValue] = useState(`${shown < 0 ? '-' : ''}${centsToInput(shown)}`);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const negative = value.trim().startsWith('-');
    const parsed = parseAmountInput(value.replace('-', ''));
    if (!Number.isFinite(parsed)) {
      setError('Monto no válido.');
      return;
    }
    const cents = negative ? -parsed : parsed;
    const realCents = isCardAccount ? -cents : cents;
    const difference = realCents - currentCents;
    if (difference === 0) {
      onClose();
      return;
    }
    setBusy(true);
    const saved = await onSave({
      kind: 'ajuste',
      cents: difference,
      accountId: account.id,
      categoryId: null,
      date: today(),
      description: 'Ajuste de saldo',
      note: `Saldo en la app: ${formatCents(currentCents)}. Saldo real: ${formatCents(realCents)}.`,
      status: 'confirmado',
    });
    setBusy(false);
    if (saved) onClose();
  }

  return (
    <Sheet
      title={`Ajustar saldo · ${account.name}`}
      size="sm"
      onClose={onClose}
      footer={(
        <>
          <span className="spacer" />
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="adjust-form" className="btn btn-primary" disabled={busy} aria-busy={busy}>{busy ? 'Guardando…' : 'Ajustar'}</button>
        </>
      )}
    >
      <form id="adjust-form" className="form-stack" onSubmit={submit} noValidate>
        <p className="form-hint">
          Escribe {isCardAccount ? 'la deuda real que muestra tu banco' : 'el saldo real que muestra tu banco'}. La diferencia se registra como un ajuste visible, que no cuenta como ingreso ni gasto.
        </p>
        <Field label={isCardAccount ? 'Deuda real' : 'Saldo real'} error={error}>
          {(props) => <input {...props} className="input input-amount" inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} autoFocus />}
        </Field>
      </form>
    </Sheet>
  );
}
