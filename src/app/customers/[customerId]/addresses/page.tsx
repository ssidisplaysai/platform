import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { getCustomerById, listCustomerAddresses } from "@/modules/foundation/customer-repository";

type PageProps = {
  params: Promise<{
    customerId: string;
  }>;
};

export default async function CustomerAddressesPage({ params }: PageProps) {
  const { customerId } = await params;
  const customer = getCustomerById(customerId);
  const addresses = listCustomerAddresses(customerId);

  return (
    <AppShell>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">Customer Addresses</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">{customer?.accountName ?? customerId}</h1>
          <p className="mt-2 text-sm text-zinc-400">Billing, shipping, and service address references.</p>
          <div className="mt-4">
            <Link href={`/customers/${customerId}/addresses/new`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">New Address</Link>
          </div>
        </header>

        <ul className="space-y-3">
          {addresses.length === 0 ? (
            <li className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">No addresses defined.</li>
          ) : addresses.map((address) => (
            <li key={address.addressId} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
              <p className="font-semibold text-white">{address.label}</p>
              <p className="text-xs text-zinc-400">{address.addressType} | {address.city}, {address.region}</p>
              <p className="mt-1 text-xs text-zinc-400">{address.line1}{address.line2 ? `, ${address.line2}` : ""}</p>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
