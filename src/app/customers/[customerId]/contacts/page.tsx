import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { getCustomerById, listCustomerContacts } from "@/modules/foundation/customer-repository";

type PageProps = {
  params: Promise<{
    customerId: string;
  }>;
};

export default async function CustomerContactsPage({ params }: PageProps) {
  const { customerId } = await params;
  const customer = getCustomerById(customerId);
  const contacts = listCustomerContacts(customerId);

  return (
    <AppShell>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">Customer Contacts</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">{customer?.accountName ?? customerId}</h1>
          <p className="mt-2 text-sm text-zinc-400">Contact governance and communication references.</p>
          <div className="mt-4">
            <Link href={`/customers/${customerId}/contacts/new`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">New Contact</Link>
          </div>
        </header>

        <ul className="space-y-3">
          {contacts.length === 0 ? (
            <li className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">No contacts defined.</li>
          ) : contacts.map((contact) => (
            <li key={contact.contactId} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
              <p className="font-semibold text-white">{contact.fullName}</p>
              <p className="text-xs text-zinc-400">{contact.role} {contact.title ? `- ${contact.title}` : ""}</p>
              <p className="mt-1 text-xs text-zinc-400">{contact.email ?? "no email"} | {contact.phone ?? "no phone"}</p>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
