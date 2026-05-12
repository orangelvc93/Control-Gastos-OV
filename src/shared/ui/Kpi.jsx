export function Kpi({ title, value, tone = 'neutral' }) {
  return (
    <div className={`kpi ${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}
