import { AppShell } from "@/components/layout/app-shell";
import {
  FOUNDATION_AUDIT_EVENTS,
  getAuditEmptyStateMessage,
} from "@/modules/foundation/state";
import { listDispatchRequestReceipts } from "@/modules/glw/exact-target-dispatch-authority";

export default function AuditPage() {
  const dispatchReceipts = listDispatchRequestReceipts();
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

        <section className="border border-zinc-800 bg-zinc-950 p-6" aria-labelledby="dispatch-provenance-heading">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-400">GLW Security</p>
          <h2 id="dispatch-provenance-heading" className="mt-2 text-xl font-semibold text-white">Exact-target dispatch provenance</h2>
          <p className="mt-2 text-sm text-zinc-400">Append-only owner authority and scheduler mutation receipts. Credentials, cookies, and authorization secrets are never stored.</p>
          <div className="mt-5 space-y-3">
            {[...dispatchReceipts].reverse().map((receipt) => <article key={receipt.requestReceiptId} className="border border-zinc-800 bg-zinc-900/50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-semibold text-white">{receipt.outcome} · {receipt.operation.replaceAll("_", " ")}</p><time className="text-xs text-zinc-500">{receipt.timestamp}</time></div><dl className="mt-3 grid gap-2 text-xs text-zinc-400 md:grid-cols-2 xl:grid-cols-4"><div><dt className="text-zinc-600">Target</dt><dd className="break-all text-zinc-300">{receipt.targetId}</dd></div><div><dt className="text-zinc-600">Principal / session</dt><dd className="break-all text-zinc-300">{receipt.principal.principalId} / {receipt.principal.sessionId}</dd></div><div><dt className="text-zinc-600">Runtime / grant</dt><dd className="break-all text-zinc-300">{receipt.runtimeSha} / {receipt.ownerDispatchGrantId}</dd></div><div><dt className="text-zinc-600">Lease / job / execution</dt><dd className="break-all text-zinc-300">{receipt.leaseId ?? "none"} / {receipt.jobId ?? "none"} / {receipt.externalExecutionId ?? "none"}</dd></div></dl><p className="mt-3 text-xs text-zinc-500">Grant {receipt.grantValidationResult} · Release {receipt.releaseAuthorityResult} · WordPress {receipt.wordpressAuthorityResult} · MCP {receipt.mcpPreflightResult} · Allowance {receipt.allowanceBefore} → {receipt.allowanceAfter}</p></article>)}
            {dispatchReceipts.length === 0 ? <p className="text-sm text-zinc-500">No exact-target dispatch requests have been recorded.</p> : null}
          </div>
        </section>
      </section>
    </AppShell>
  );
}
