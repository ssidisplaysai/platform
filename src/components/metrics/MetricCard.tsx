type MetricCardProps = {
  label: string;
  value: string;
  helperText?: string;
  trend?: string;
};

export function MetricCard({
  label,
  value,
  helperText,
  trend,
}: MetricCardProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-500">
            {label}
          </p>

          <h2 className="mt-2 text-3xl font-bold text-white">{value}</h2>
        </div>

        {trend ? (
          <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-300">
            {trend}
          </span>
        ) : null}
      </div>

      {helperText ? (
        <p className="mt-3 text-sm text-zinc-500">{helperText}</p>
      ) : null}
    </div>
  );
}