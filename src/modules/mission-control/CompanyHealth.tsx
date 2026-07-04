const companies = [
  {
    name: "Screen Solutions International",
    status: "Operational",
    summary: "Projects active, quoting steady, service queue normal.",
  },
  {
    name: "RJ Metal",
    status: "Production",
    summary: "Fabrication workflow active with manufacturing capacity available.",
  },
  {
    name: "Green Machine Works",
    status: "Planning",
    summary: "Product and leasing model under development.",
  },
  {
    name: "LED Display Warehouse",
    status: "Growth",
    summary: "Catalog, SEO, and ecommerce infrastructure expanding.",
  },
  {
    name: "STONER",
    status: "Brand Build",
    summary: "Collector ecosystem, product drops, and brand foundation in progress.",
  },
];

export function CompanyHealth() {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
      <div className="mb-5">
        <p className="text-sm uppercase tracking-[0.3em] text-red-500">
          Company Health
        </p>

        <h2 className="mt-2 text-2xl font-semibold text-white">
          Cross-company operating status
        </h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {companies.map((company) => (
          <div
            key={company.name}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"
          >
            <p className="text-sm font-semibold text-white">{company.name}</p>

            <p className="mt-2 text-xs uppercase tracking-widest text-red-500">
              {company.status}
            </p>

            <p className="mt-3 text-sm leading-6 text-zinc-400">
              {company.summary}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}