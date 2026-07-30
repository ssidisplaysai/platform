import Link from "next/link";
import { listCustomerActivity } from "./customer-audit";
import {
  detectCustomerDuplicates,
  evaluateCustomerReadinessById,
  getCustomerById,
  listCustomerAddresses,
  listCustomerContacts,
} from "./customer-repository";

export function CustomerDetailView(input: { customerId: string }) {
  const customer = getCustomerById(input.customerId);

  if (!customer) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
        Customer {input.customerId} was not found.
      </div>
    );
  }

  const contacts = listCustomerContacts(customer.customerId);
  const addresses = listCustomerAddresses(customer.customerId);
  const readiness = evaluateCustomerReadinessById({
    customerId: customer.customerId,
    requiredPermission: "customers:evaluate_readiness",
    permissions: new Set(["customers:evaluate_readiness"]),
  });
  const duplicates = detectCustomerDuplicates(customer.customerId);
  const activity = listCustomerActivity(customer.customerId);

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-red-500">Customer Detail</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">{customer.accountName}</h1>
        <p className="mt-2 text-sm text-zinc-400">{customer.accountCode}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-300">
          <span className="rounded-full border border-zinc-700 px-2 py-1">{customer.accountType}</span>
          <span className="rounded-full border border-zinc-700 px-2 py-1">{customer.lifecycleState}</span>
          <span className="rounded-full border border-zinc-700 px-2 py-1">{customer.enabled ? "enabled" : "disabled"}</span>
          <span className="rounded-full border border-zinc-700 px-2 py-1">ready: {readiness?.ready ? "yes" : "no"}</span>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Account Configuration</h2>
          <dl className="mt-3 space-y-2 text-sm text-zinc-300">
            <div><dt className="text-zinc-500">Customer ID</dt><dd>{customer.customerId}</dd></div>
            <div><dt className="text-zinc-500">Organization</dt><dd>{customer.organizationId}</dd></div>
            <div><dt className="text-zinc-500">Primary Site</dt><dd>{customer.primarySiteId ?? "Not assigned"}</dd></div>
            <div><dt className="text-zinc-500">Associated Sites</dt><dd>{customer.associatedSiteIds.join(", ") || "None"}</dd></div>
            <div><dt className="text-zinc-500">Primary Contact</dt><dd>{customer.primaryContactId ?? "Not assigned"}</dd></div>
            <div><dt className="text-zinc-500">Billing Address</dt><dd>{customer.billingAddressId ?? "Not assigned"}</dd></div>
            <div><dt className="text-zinc-500">Shipping Address</dt><dd>{customer.shippingAddressId ?? "Not assigned"}</dd></div>
          </dl>
        </article>

        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Readiness And Signals</h2>
          <p className="mt-2 text-sm text-zinc-300">Readiness: {readiness?.status ?? "unknown"}</p>
          <p className="text-sm text-zinc-300">Contacts: {contacts.length}</p>
          <p className="text-sm text-zinc-300">Addresses: {addresses.length}</p>
          {readiness && readiness.blockingReasons.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs text-amber-300">
              {readiness.blockingReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-emerald-300">No blocking readiness conditions.</p>
          )}

          {duplicates.length > 0 ? (
            <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Duplicate Indicators</p>
              <ul className="mt-2 space-y-1 text-xs text-amber-300">
                {duplicates.map((item) => (
                  <li key={item.matchedCustomerId}>
                    {item.matchedCustomerId} ({Math.round(item.confidence * 100)}%): {item.reasons.join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>
      </div>

      <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="text-lg font-semibold text-white">Recent Customer Activity</h2>
        {activity.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">No customer activity recorded yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-zinc-300">
            {activity.map((entry) => (
              <li key={entry.activityId}>{entry.createdAt} - {entry.type} - {entry.summary}</li>
            ))}
          </ul>
        )}
      </article>

      <div className="flex flex-wrap gap-3">
        <Link href={`/customers/${customer.customerId}/settings`} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-red-500 hover:text-white">Account Settings</Link>
        <Link href={`/customers/${customer.customerId}/contacts`} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-red-500 hover:text-white">Contacts</Link>
        <Link href={`/customers/${customer.customerId}/addresses`} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-red-500 hover:text-white">Addresses</Link>
        <Link href={`/customers/${customer.customerId}/readiness`} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-red-500 hover:text-white">Readiness</Link>
      </div>
    </section>
  );
}
