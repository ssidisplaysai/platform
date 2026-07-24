import type { ReactNode } from "react";

type DataTableColumn<T> = {
  header: string;
  className?: string;
  cell: (row: T) => ReactNode;
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyState: ReactNode;
};

export function DataTable<T>({ columns, rows, rowKey, emptyState }: DataTableProps<T>) {
  if (rows.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-[0.25em] text-zinc-500">
          <tr>
            {columns.map((column) => (
              <th key={column.header} className={`px-5 py-3 font-medium ${column.className ?? ""}`.trim()}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 bg-white">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="align-top text-zinc-700 transition hover:bg-zinc-50/70">
              {columns.map((column) => (
                <td key={column.header} className={`px-5 py-4 ${column.className ?? ""}`.trim()}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
