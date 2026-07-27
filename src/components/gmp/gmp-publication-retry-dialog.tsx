"use client";

import React from "react";
import { FormEvent, useState } from "react";

type RetryPayload = {
  attemptNumber: number;
  failureCategory?: string;
  failureMessage?: string;
  retryable?: boolean;
};

export function GmpPublicationRetryDialog({
  publicationId,
  prior,
  onRetried,
}: {
  publicationId: string;
  prior: RetryPayload;
  onRetried: () => Promise<void> | void;
}) {
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    const response = await fetch(`/api/gmp/publishing/publications/${publicationId}/retry`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    }).catch(() => null);

    if (!response?.ok) {
      setStatus("Retry failed.");
      return;
    }

    setStatus("Retry submitted.");
    setReason("");
    await onRetried();
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <h3 className="text-sm font-semibold text-white">Retry Publication</h3>
      <p className="mt-1 text-xs text-zinc-400">Prior attempt #{prior.attemptNumber} • {prior.failureCategory ?? "unknown"} • {prior.retryable ? "retryable" : "not retryable"}</p>
      <p className="text-xs text-zinc-400">Failure message: {prior.failureMessage ?? "none"}</p>
      <p className="text-xs text-zinc-400">Expected operation: update/publish re-attempt. Next attempt number: {prior.attemptNumber + 1}</p>
      <label className="mt-2 block text-xs uppercase tracking-[0.2em] text-zinc-500">Retry reason</label>
      <textarea required value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-sm text-white" rows={3} />
      <button type="submit" className="mt-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-zinc-950">Submit Retry</button>
      {status ? <p className="mt-2 text-xs text-zinc-300">{status}</p> : null}
    </form>
  );
}
