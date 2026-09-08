import React from 'react';

export interface ColumnDef<T> {
  key: string;
  header: string;
  /** render override; receives the row object */
  render?: (row: T) => React.ReactNode;
  /** right-align this column (for numeric data) */
  numeric?: boolean;
  /** additional className on <td> */
  cellClassName?: string;
  /** width hint, e.g. 'w-32' */
  width?: string;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  loading?: boolean;
  className?: string;
}

function getCellValue<T>(row: T, key: string): React.ReactNode {
  // support dot-notation access one level deep
  const parts = key.split('.');
  let val: unknown = row;
  for (const p of parts) {
    val = (val as Record<string, unknown>)?.[p];
  }
  return val as React.ReactNode;
}

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  emptyMessage = 'No data available.',
  loading = false,
  className = '',
}: DataTableProps<T>) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-panel border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`
                  px-4 py-2.5 text-left text-xs font-semibold text-text-secondary
                  uppercase tracking-wide whitespace-nowrap
                  ${col.numeric ? 'text-right' : ''}
                  ${col.width ?? ''}
                `}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <tr key={i} className="border-b border-border">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <div className="h-4 bg-panel rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-sm text-text-secondary"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                className={`
                  border-b border-border last:border-0
                  ${onRowClick ? 'cursor-pointer hover:bg-panel transition-colors duration-100' : ''}
                `}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`
                      px-4 py-3 text-text-primary
                      ${col.numeric ? 'text-right tabular-nums font-medium' : ''}
                      ${col.cellClassName ?? ''}
                    `}
                  >
                    {col.render ? col.render(row) : getCellValue(row, col.key)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
