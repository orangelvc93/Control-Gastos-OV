// Fecha local (no UTC): en Ecuador toISOString() devuelve el día siguiente desde las 19:00.
export function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function addDays(date, days) {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(year, month - 1, day + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

const monthNames = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export function formatDisplayDate(date) {
  if (!date) return '-';
  const [, month, day] = String(date).split('-');
  const dayNumber = Number(day);

  return dayNumber || date;
}

export function formatExcelDate(date) {
  if (!date) return '';
  const [year, month, day] = String(date).split('-');
  const dayNumber = Number(day);
  const monthNumber = Number(month);

  if (!dayNumber || !monthNumber || !year) return date;
  return `${String(dayNumber).padStart(2, '0')}/${String(monthNumber).padStart(2, '0')}/${year}`;
}

export function getDateDay(date) {
  const day = String(date || today()).split('-')[2];
  return Number(day) || new Date().getDate();
}

export function getMonthNumber(monthName) {
  const monthIndex = monthNames.findIndex((month) => month === String(monthName).toLowerCase());
  return monthIndex >= 0 ? monthIndex + 1 : new Date().getMonth() + 1;
}

export function daysInMonth(year, monthName) {
  return new Date(Number(year), getMonthNumber(monthName), 0).getDate();
}

export function buildDateFromParts(year, monthName, day) {
  const month = getMonthNumber(monthName);
  const maxDay = daysInMonth(year, monthName);
  const safeDay = Math.min(Math.max(Number(day) || 1, 1), maxDay);

  return `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
}

export function openDatePicker(event) {
  event.currentTarget.showPicker?.();
}
