import { formatDisplayDate } from '../../shared/lib/date';
import { money } from '../../shared/lib/money';
import { toNumber } from '../../shared/lib/numbers';
import { LinkButton } from '../../shared/ui/Button';
import { Table } from '../../shared/ui/Table';

export function MovementsTable({ collection, deleteMovement, editMovement, rows, type }) {
  const columns = type === 'payment'
    ? ['Fecha', 'Categoria', 'Concepto', 'Estado', 'Monto', 'Acciones']
    : ['Fecha', 'Origen', 'Concepto', 'Tipo', 'Estado', 'Monto', 'Acciones'];

  return (
    <Table
      className="movements-table"
      columns={columns}
      rows={rows.map((row) => {
        const source = type === 'payment' ? row.category : row.source;
        const amount = toNumber(row.amount);
        const displayDate = formatDisplayDate(row.date);
        const actionCell = {
          content: (
            <span className="actions">
              <LinkButton onClick={() => editMovement(collection, row)}>Editar</LinkButton>
              <LinkButton onClick={() => deleteMovement(collection, row)}>Eliminar</LinkButton>
            </span>
          ),
          filterValue: '',
        };

        const cells = [
          { content: displayDate, filterValue: `${displayDate} ${row.date ?? ''}` },
          source,
          row.concept,
          ...(type === 'income' ? [row.type] : []),
          row.status,
          { content: money.format(amount), filterValue: amount },
          actionCell,
        ];

        return { cells, className: row.status === 'Pendiente' ? 'pending-row' : '' };
      })}
    />
  );
}
