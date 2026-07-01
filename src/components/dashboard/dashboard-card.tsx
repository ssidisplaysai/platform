export function DashboardCard({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 transition hover:border-red-500">
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>
    </div>
  );
}