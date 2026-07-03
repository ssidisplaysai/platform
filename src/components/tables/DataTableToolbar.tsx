type DataTableToolbarProps = {
  title: string;
  description?: string;
  searchPlaceholder?: string;
};

export function DataTableToolbar({
  title,
  description,
  searchPlaceholder = "Search...",
}: DataTableToolbarProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-zinc-800 p-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>

        {description ? (
          <p className="mt-1 text-sm text-zinc-500">{description}</p>
        ) : null}
      </div>

      <input
        type="search"
        placeholder={searchPlaceholder}
        className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-red-500 md:w-72"
      />
    </div>
  );
}