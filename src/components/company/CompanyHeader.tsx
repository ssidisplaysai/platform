type CompanyHeaderProps = {
  name: string;
  description: string;
  accentColor?: string;
};

export function CompanyHeader({
  name,
  description,
  accentColor = "#ef4444",
}: CompanyHeaderProps) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
      <p
        className="text-xs font-semibold uppercase tracking-[0.35em]"
        style={{ color: accentColor }}
      >
        Company Workspace
      </p>

      <h1 className="mt-3 text-4xl font-bold tracking-tight text-white">
        {name}
      </h1>

      <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-400">
        {description}
      </p>
    </div>
  );
}