type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
};

export function MetricCard({ label, value, detail }: MetricCardProps) {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm shadow-zinc-950/[0.02] transition hover:border-zinc-300">
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <div className="mt-4 flex items-end justify-between gap-4">
        <p className="text-3xl font-semibold tracking-tight text-zinc-950">{value}</p>
      </div>
      <p className="mt-2 text-sm leading-6 text-zinc-500">{detail}</p>
    </article>
  );
}
