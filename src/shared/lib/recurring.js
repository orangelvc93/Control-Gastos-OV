import { monthNames } from './ledger';

// Fechas de los gastos e ingresos frecuentes. Todo con fechas "YYYY-MM-DD" en hora local.
//  - semanal: cada 7 días desde la fecha de inicio.
//  - quincenal: dos veces al mes, el día de inicio y 15 días después (p. ej. 1 y 16, o 15 y 30).
//  - mensual: el mismo día cada mes (si el mes es más corto, el último día).
//  - anual: la misma fecha cada año.

export const frequencyLabels = {
  semanal: 'Semanal',
  quincenal: 'Quincenal',
  mensual: 'Mensual',
  anual: 'Anual',
};

function parse(date) {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
}

function format(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function addDays(date, days) {
  const { year, month, day } = parse(date);
  const value = new Date(year, month - 1, day + days);
  return format(value.getFullYear(), value.getMonth() + 1, value.getDate());
}

function monthDates(year, month, days) {
  const last = daysInMonth(year, month);
  return [...new Set(days.map((day) => Math.min(day, last)))].sort((a, b) => a - b).map((day) => format(year, month, day));
}

// Fechas del frecuente entre from y to (incluidas), respetando inicio y fin.
export function occurrencesBetween(item, from, to) {
  const start = item.startDate > from ? item.startDate : from;
  const end = item.endDate && item.endDate < to ? item.endDate : to;
  if (start > end) return [];
  const anchor = parse(item.startDate);
  const result = [];

  if (item.frequency === 'semanal') {
    let date = item.startDate;
    while (date <= end) {
      if (date >= start) result.push(date);
      date = addDays(date, 7);
    }
    return result;
  }

  const days = item.frequency === 'quincenal'
    ? [anchor.day, anchor.day > 15 ? anchor.day - 15 : anchor.day + 15]
    : [anchor.day];
  let { year, month } = parse(start);
  const stop = parse(end);
  while (year < stop.year || (year === stop.year && month <= stop.month)) {
    if (item.frequency !== 'anual' || month === anchor.month) {
      for (const date of monthDates(year, month, days)) {
        if (date >= start && date <= end && date >= item.startDate) result.push(date);
      }
    }
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return result;
}

export function frequencyDetail(item) {
  const { day, month } = parse(item.startDate);
  if (item.frequency === 'semanal') {
    const weekday = new Date(`${item.startDate}T12:00:00`).toLocaleDateString('es-EC', { weekday: 'long' });
    return `Cada ${weekday}`;
  }
  if (item.frequency === 'quincenal') {
    const other = day > 15 ? day - 15 : day + 15;
    return `Días ${Math.min(day, other)} y ${Math.max(day, other)} de cada mes`;
  }
  if (item.frequency === 'mensual') return `Día ${day} de cada mes`;
  return `Cada ${day} de ${monthNames[month - 1].toLowerCase()}`;
}

// Ocurrencias pendientes de registrar: vencidas (desde hace `pastDays`) o próximas (hasta `futureDays`).
export function dueOccurrences(items, transactions, today, { pastDays = 31, futureDays = 15 } = {}) {
  const registered = new Set(
    transactions
      .filter((transaction) => transaction.recurringId && !transaction.deletedAt)
      .map((transaction) => `${transaction.recurringId}:${transaction.occurrenceDate}`),
  );
  const from = addDays(today, -pastDays);
  const to = addDays(today, futureDays);

  return items
    .filter((item) => !item.archivedAt)
    .flatMap((item) => occurrencesBetween(item, from, to)
      .filter((date) => !registered.has(`${item.id}:${date}`))
      .map((date) => ({ item, date, overdue: date < today, isToday: date === today })))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function nextOccurrence(item, today) {
  return occurrencesBetween(item, today, addDays(today, 400))[0] ?? null;
}
