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
  selectedRowKey?: string | null;
  onRowClick?: (row: T) => void;
};

export function DataTable<T>({ columns, rows, rowKey, emptyState, selectedRowKey, onRowClick }: DataTableProps<T>) {
  if (rows.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <div className="w-full min-w-0 overflow-x-hidden">
      <table className="w-full min-w-0 table-fixed text-left text-sm">
        <thead className="border-b border-zinc-800 bg-zinc-950 text-xs uppercase tracking-[0.25em] text-zinc-500">
          <tr>
            {columns.map((column) => (
              <th key={column.header} className={`min-w-0 px-5 py-3 font-medium ${column.className ?? ""}`.trim()}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800 bg-zinc-900">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`align-top text-zinc-300 transition ${onRowClick ? "cursor-pointer hover:bg-zinc-800/60" : ""} ${selectedRowKey === rowKey(row) ? "bg-zinc-800/70 ring-1 ring-inset ring-zinc-700" : ""}`.trim()}
            >
              {columns.map((column) => (
                <td key={column.header} className={`min-w-0 px-5 py-4 ${column.className ?? ""}`.trim()}>
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
