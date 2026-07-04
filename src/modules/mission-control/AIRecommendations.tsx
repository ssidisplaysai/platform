const recommendations = [
  {
    agent: "CEO Agent",
    message: "Review cross-company priorities before adding new initiatives.",
  },
  {
    agent: "Sales Agent",
    message: "Focus follow-up energy on active quote opportunities.",
  },
  {
    agent: "Manufacturing Agent",
    message: "Confirm capacity before accepting urgent production work.",
  },
  {
    agent: "Marketing Agent",
    message: "Continue building SEO and brand assets across priority companies.",
  },
];

export function AIRecommendations() {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
      <p className="text-sm uppercase tracking-[0.3em] text-red-500">
        AI Executive Team
      </p>

      <h2 className="mt-2 text-2xl font-semibold text-white">
        Recommendations
      </h2>

      <div className="mt-5 space-y-3">
        {recommendations.map((item) => (
          <div
            key={item.agent}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"
          >
            <p className="text-sm font-semibold text-white">{item.agent}</p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              {item.message}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}