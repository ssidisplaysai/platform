import { AppShell } from "@/components/layout/app-shell";
import {
  FOUNDATION_AUDIT_EVENTS,
  getAuditEmptyStateMessage,
} from "@/modules/foundation/state";

export default function AuditPage() {
  return (
    <AppShell>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">
            Audit Foundation
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">
            Audit Event Foundation
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Governance and lifecycle event surface for future operational audit
            workflows.
          </p>
        </header>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          {FOUNDATION_AUDIT_EVENTS.length === 0 ? (
            <p className="text-sm text-zinc-400">{getAuditEmptyStateMessage()}</p>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
