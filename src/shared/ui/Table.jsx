import { useEffect, useState } from 'react';

function cellContent(cell) {
  if (cell && typeof cell === 'object' && Object.hasOwn(cell, 'content')) return cell.content;
  return cell;
}

function rowCells(row) {
  return row && typeof row === 'object' && Object.hasOwn(row, 'cells') ? row.cells : row;
}

function rowClassName(row) {
  return row && typeof row === 'object' && Object.hasOwn(row, 'className') ? row.className : '';
}

function cellFilterValue(cell) {
  if (cell && typeof cell === 'object' && Object.hasOwn(cell, 'filterValue')) return cell.filterValue ?? '';
  if (typeof cell === 'string' || typeof cell === 'number') return cell;
  return '';
}

export function Table({ className = '', columns, rows }) {
  const [filters, setFilters] = useState(() => columns.map(() => ''));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(7);
  const filterableColumns = columns.map((column) => column !== 'Acciones');
  const visibleRows = rows.filter((row) => filters.every((filter, index) => {
    if (!filter || !filterableColumns[index]) return true;
    return String(cellFilterValue(rowCells(row)[index])).toLowerCase().includes(filter.toLowerCase());
  }));
  const totalPages = Math.max(Math.ceil(visibleRows.length / pageSize), 1);
  const pageStart = (page - 1) * pageSize;
  const pageRows = visibleRows.slice(pageStart, pageStart + pageSize);
  const firstVisible = visibleRows.length ? pageStart + 1 : 0;
  const lastVisible = Math.min(pageStart + pageSize, visibleRows.length);

  useEffect(() => {
    setPage(1);
  }, [filters, pageSize]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  function updateFilter(index, value) {
    setFilters((current) => current.map((filter, filterIndex) => (filterIndex === index ? value : filter)));
  }

  return (
    <div className={`table-shell ${className}`.trim()}>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
            <tr className="filter-row">
              {columns.map((column, index) => (
                <th key={`${column}-filter`}>
                  {filterableColumns[index] && (
                    <input
                      aria-label={`Filtrar ${column}`}
                      className="table-filter"
                      placeholder="Filtrar"
                      value={filters[index]}
                      onChange={(event) => updateFilter(index, event.target.value)}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, rowIndex) => (
              <tr key={`${page}-${rowIndex}`} className={rowClassName(row)}>
                {rowCells(row).map((cell, cellIndex) => <td key={cellIndex}>{cellContent(cell)}</td>)}
              </tr>
            ))}
            {!visibleRows.length && (
              <tr>
                <td className="empty-row" colSpan={columns.length}>Sin resultados</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="table-pagination">
        <span>Mostrando {firstVisible}-{lastVisible} de {visibleRows.length}</span>
        <div className="pagination-actions">
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} aria-label="Filas por pagina">
            <option value="7">7 filas</option>
            <option value="15">15 filas</option>
            <option value="30">30 filas</option>
          </select>
          <button type="button" onClick={() => setPage((current) => Math.max(current - 1, 1))} disabled={page <= 1}>Anterior</button>
          <strong>{page} / {totalPages}</strong>
          <button type="button" onClick={() => setPage((current) => Math.min(current + 1, totalPages))} disabled={page >= totalPages}>Siguiente</button>
        </div>
      </div>
    </div>
  );
}
