import { AppShell } from "@/components/layout/app-shell";
import { createFoundationContext } from "@/modules/foundation/context";
import { evaluateCustomerReadinessById } from "@/modules/foundation/customer-repository";
import { resolvePermissions } from "@/modules/foundation/permissions";

type PageProps = {
  params: Promise<{
    customerId: string;
  }>;
};

export default async function CustomerReadinessPage({ params }: PageProps) {
  const { customerId } = await params;
  const context = createFoundationContext();
  const permissions = resolvePermissions(context.user.roles);
  const readiness = evaluateCustomerReadinessById({
    customerId,
    requiredPermission: "customers:evaluate_readiness",
    permissions,
  });

  return (
    <AppShell>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">Customer Readiness</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">{customerId}</h1>
          <p className="mt-2 text-sm text-zinc-400">Deterministic account readiness policy output.</p>
        </header>

        {!readiness ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">Customer not found.</div>
        ) : (
          <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-sm text-zinc-300">Status: {readiness.status}</p>
            <p className="text-sm text-zinc-300">Ready: {readiness.ready ? "Yes" : "No"}</p>
            <ul className="mt-3 space-y-2 text-xs text-zinc-300">
              {readiness.checkedConditions.map((condition) => (
                <li key={condition.key} className={condition.passed ? "text-emerald-300" : "text-amber-300"}>
                  {condition.key}: {condition.details}
                </li>
              ))}
            </ul>
          </article>
        )}
      </section>
    </AppShell>
  );
}
