import { money } from './money';

// Toda la aritmética de dinero va en centavos enteros: 0,1 + 0,2 no da 0,3 con decimales flotantes.
// Se convierte a dólares solo al mostrar o al enviar a la base (numeric(14,2)).

export function toCents(value) {
  if (value === null || value === undefined || value === '') return 0;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

export function centsToDb(cents) {
  return (cents / 100).toFixed(2);
}

export function formatCents(cents) {
  // `|| 0` convierte -0 en 0: evita mostrar "$-0,00".
  return money.format((cents || 0) / 100);
}

export function sumCents(items, selector = (item) => item) {
  return items.reduce((total, item) => total + selector(item), 0);
}

// Acepta lo que se escribe en un teclado en español: "12,50", "1.234,56", "1234.56".
// Devuelve centavos positivos, o NaN si el texto no es un monto válido.
export function parseAmountInput(text) {
  const raw = String(text ?? '').trim().replace(/\s|\$/g, '');
  if (!raw) return NaN;
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw;
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return NaN;
  return Math.round(Number(normalized) * 100);
}

export function centsToInput(cents) {
  return (Math.abs(cents) / 100).toFixed(2).replace('.', ',');
}
