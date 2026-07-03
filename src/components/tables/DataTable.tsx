import { DataTableToolbar } from "./DataTableToolbar";

type DataTableColumn<T> = {
  key: keyof T;
  label: string;
};

type DataTableProps<T> = {
  title: string;
  description?: string;
  columns: DataTableColumn<T>[];
  data: T[];
};

export function DataTable<T extends Record<string, string | number>>({
  title,
  description,
  columns,
  data,
}: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
      <DataTableToolbar
        title={title}
        description={description}
        searchPlaceholder={`Search ${title.toLowerCase()}...`}
      />

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead className="bg-zinc-900/80">
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className="border-b border-zinc-800 px-4 py-3 text-xs font-semibold uppercase tracking-widest text-zinc-500"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-b border-zinc-900 transition hover:bg-zinc-900/60"
              >
                {columns.map((column) => (
                  <td
                    key={String(column.key)}
                    className="px-4 py-4 text-sm text-zinc-300"
                  >
                    {row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}