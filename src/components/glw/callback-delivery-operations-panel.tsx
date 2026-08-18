"use client";

import { useEffect, useState } from "react";
import { PageContainer } from "./page-container";
import type { GlwDeliveryOperationsSnapshot, GlwDeliverySafeSummary } from "@/lib/glw/callback-delivery-operations";

type Permissions = { canView: boolean; canOperate: boolean; canRequestRecovery: boolean; canApproveRecovery: boolean };

function age(value: string | null) {
  return value ? new Date(value).toLocaleString() : "-";
}

export function CallbackDeliveryOperationsPanel() {
  const [snapshot, setSnapshot] = useState<GlwDeliveryOperationsSnapshot | null>(null);
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [selected, setSelected] = useState<GlwDeliverySafeSummary | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const response = await fetch("/api/glw/callback-deliveries", { cache: "no-store", credentials: "include" });
    const payload = await response.json().catch(() => null) as { snapshot?: GlwDeliveryOperationsSnapshot; permissions?: Permissions; error?: string } | null;
    if (!response.ok || !payload?.snapshot) {
      setError(payload?.error ?? "Delivery operations are unavailable.");
      return;
    }
    setSnapshot(payload.snapshot);
    setPermissions(payload.permissions ?? null);
    setError(null);
  };

  useEffect(() => {
    const initialTimer = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), 15_000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(timer);
    };
  }, []);

  const post = async (body: Record<string, unknown>) => {
    const response = await fetch("/api/glw/callback-deliveries", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, reason, requestId: crypto.randomUUID() }),
    });
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) setError(payload?.error ?? "Operator action failed.");
    else {
      setReason("");
      await load();
    }
  };

  const metrics = snapshot?.metrics ?? {};
  return (
    <PageContainer>
      <div className="space-y-5">
        <header className="border-b border-zinc-800 pb-4">
          <h1 className="text-2xl font-semibold text-zinc-100">Delivery Operations</h1>
          <p className="mt-1 text-sm text-zinc-400">Durable callback state, escalation, and recovery authorization</p>
        </header>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {["pending", "retrying", "acknowledged", "deadLetter"].map((key) => (
            <div key={key} className="rounded border border-zinc-800 bg-zinc-950 p-3">
              <p className="text-xs uppercase text-zinc-500">{key}</p>
              <p className="mt-1 text-xl font-semibold text-zinc-100">{metrics[key] ?? 0}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <span className="text-sm text-zinc-400">Operational state</span>
          <strong className="text-sm text-zinc-100">{snapshot?.operationalStatus ?? "LOADING"}</strong>
        </div>
        {error ? <p className="border border-red-900 bg-red-950 p-3 text-sm text-red-200">{error}</p> : null}
        <div className="overflow-x-auto border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-zinc-400"><tr><th className="p-3">Delivery</th><th>State</th><th>Attempts</th><th>Last attempt</th><th>Reason</th></tr></thead>
            <tbody>
              {(snapshot?.deliveries ?? []).map((delivery) => (
                <tr key={delivery.deliveryRef} className="cursor-pointer border-t border-zinc-800 hover:bg-zinc-900" onClick={() => setSelected(delivery)}>
                  <td className="p-3 font-mono text-xs">{delivery.deliveryRef}</td><td>{delivery.deliveryStatus}</td><td>{delivery.attemptCount}</td><td>{age(delivery.lastAttemptAt)}</td><td>{delivery.deadLetterReason ?? delivery.lastErrorClass ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selected ? (
          <section className="border border-zinc-800 bg-zinc-950 p-4">
            <div className="grid gap-2 text-sm md:grid-cols-2">
              <p>Payload SHA-256: <span className="font-mono text-xs">{selected.payloadSha256}</span></p>
              <p>Payload bytes: {selected.payloadSizeBytes}</p>
              <p>Job: {selected.jobId}</p><p>Execution: {selected.executionId}</p>
              <p>Next retry: {age(selected.nextAttemptAt)}</p><p>Deadline: {age(selected.deliveryDeadlineAt)}</p>
            </div>
            {permissions?.canOperate ? <textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-4 min-h-20 w-full border border-zinc-700 bg-zinc-900 p-2" placeholder="Required operator reason" /> : null}
            {permissions?.canRequestRecovery && selected.deliveryStatus === "DEAD_LETTER" ? (
              <button className="mt-3 border border-amber-700 px-3 py-2 text-sm text-amber-200" onClick={() => void post({ action: "REQUEST_RECOVERY", idempotencyKey: selected.idempotencyRef })}>Request recovery</button>
            ) : null}
          </section>
        ) : null}
      </div>
    </PageContainer>
  );
}
