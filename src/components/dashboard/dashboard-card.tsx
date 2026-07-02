export function DashboardCard({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900 p-8 transition-all duration-300 hover:-translate-y-1 hover:border-red-500 hover:shadow-2xl hover:shadow-red-900/20">
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>
    </div>
  );
}