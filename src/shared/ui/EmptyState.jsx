import { Card } from './Card';

export function EmptyState({ title, children }) {
  return (
    <Card className="empty-state">
      <strong>{title}</strong>
      <span>{children}</span>
    </Card>
  );
}
