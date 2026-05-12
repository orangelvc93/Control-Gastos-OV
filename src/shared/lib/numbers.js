export function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sum(items, selector) {
  return items.reduce((total, item) => total + toNumber(selector(item)), 0);
}
