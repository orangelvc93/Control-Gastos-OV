import { useEffect, useRef, useState } from 'react';
import { today } from '../../shared/lib/date';
import { Icon } from './Icon';

// Fecha escribible en el celular: teclado numérico, "20102026" → "20/10/2026".
// El calendario nativo sigue disponible con el botón, y hay atajos Hoy / Ayer.
// value y onChange usan "YYYY-MM-DD" ('' si lo escrito no es una fecha válida).

function isoToText(iso) {
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

function textToIso(text) {
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return '';
  const [, day, month, year] = match.map(Number);
  const date = new Date(year, month - 1, day);
  const valid = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return valid ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
}

function formatTyping(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function shift(iso, days) {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function DateField({ value, onChange, shortcuts = true, ...inputProps }) {
  const [text, setText] = useState(() => isoToText(value));
  const pickerRef = useRef(null);

  // Si la fecha cambia desde fuera (atajo o calendario), se refleja en el texto.
  useEffect(() => {
    if (textToIso(text) !== value) setText(isoToText(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function type(event) {
    const next = formatTyping(event.target.value);
    setText(next);
    onChange(textToIso(next));
  }

  function openPicker() {
    const picker = pickerRef.current;
    if (!picker) return;
    if (typeof picker.showPicker === 'function') {
      try {
        picker.showPicker();
        return;
      } catch {
        // Algunos navegadores no permiten showPicker: se usa el clic.
      }
    }
    picker.click();
  }

  const todayIso = today();

  return (
    <div className="date-field">
      <div className="date-input">
        <input
          {...inputProps}
          className="input"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="dd/mm/aaaa"
          maxLength={10}
          value={text}
          onChange={type}
        />
        <button type="button" className="icon-button" onClick={openPicker} aria-label="Elegir en el calendario">
          <Icon name="calendar" size={18} />
        </button>
        <input
          ref={pickerRef}
          className="date-picker-native"
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {shortcuts && (
        <div className="date-shortcuts">
          <button type="button" className={`chip ${value === todayIso ? 'is-active' : ''}`} onClick={() => onChange(todayIso)}>Hoy</button>
          <button type="button" className={`chip ${value === shift(todayIso, -1) ? 'is-active' : ''}`} onClick={() => onChange(shift(todayIso, -1))}>Ayer</button>
        </div>
      )}
    </div>
  );
}
