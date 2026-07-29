import Link from "next/link";
import { evaluateCustomerReadinessById, listCustomers } from "./customer-repository";

export function CustomersRegistryView(input: {
  query?: string;
  enabledOnly?: boolean;
}) {
  const customers = listCustomers({
    query: input.query,
    enabled: input.enabledOnly ? true : undefined,
  });

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-red-500">Customer Foundation</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Customer Account Registry</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Bounded customer, contact, and account records with readiness and duplicate-detection support.
        </p>
        <form className="mt-4 grid gap-3 md:grid-cols-3" action="" method="GET">
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            Search
            <input
              type="text"
              name="query"
              defaultValue={input.query ?? ""}
              placeholder="account, code, contact"
              className="mt-1 h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200"
            />
          </label>
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            Filter
            <select
              name="enabledOnly"
              defaultValue={input.enabledOnly ? "true" : "false"}
              className="mt-1 h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200"
            >
              <option value="false">All Accounts</option>
              <option value="true">Enabled Only</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="h-10 rounded-lg border border-zinc-700 px-4 text-sm text-zinc-300 hover:border-red-500 hover:text-white"
            >
              Apply Filters
            </button>
            <Link
              href="/customers/new"
              className="h-10 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-red-500 hover:text-white"
            >
              New Customer
            </Link>
          </div>
        </form>
      </header>

      {customers.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
          No customer accounts matched the current filters.
        </div>
      ) : (
        <ul className="space-y-3">
          {customers.map((customer) => {
            const readiness = evaluateCustomerReadinessById({
              customerId: customer.customerId,
              requiredPermission: "customers:evaluate_readiness",
              permissions: new Set(["customers:evaluate_readiness"]),
            });

            return (
              <li
                key={customer.customerId}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-zinc-500">{customer.accountType} account</p>
                    <h2 className="mt-1 text-lg font-semibold text-white">{customer.accountName}</h2>
                    <p className="text-xs text-zinc-500">{customer.accountCode}</p>
                    <p className="mt-2 text-zinc-400">{customer.legalName ?? "No legal entity name set."}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300 lg:grid-cols-3">
                    <span className="rounded border border-zinc-700 px-2 py-1">Lifecycle: {customer.lifecycleState}</span>
                    <span className="rounded border border-zinc-700 px-2 py-1">Enabled: {customer.enabled ? "Yes" : "No"}</span>
                    <span className="rounded border border-zinc-700 px-2 py-1">Ready: {readiness?.ready ? "Yes" : "No"}</span>
                    <span className="rounded border border-zinc-700 px-2 py-1">Sites: {customer.associatedSiteIds.length}</span>
                    <span className="rounded border border-zinc-700 px-2 py-1">Primary Contact: {customer.primaryContactId ?? "None"}</span>
                    <span className="rounded border border-zinc-700 px-2 py-1">Tags: {customer.tags.length}</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/customers/${customer.customerId}`}
                    className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white"
                  >
                    Open Account
                  </Link>
                  <Link
                    href={`/customers/${customer.customerId}/readiness`}
                    className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white"
                  >
                    Readiness
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
