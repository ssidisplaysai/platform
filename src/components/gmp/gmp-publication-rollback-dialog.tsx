"use client";

import React from "react";
import { FormEvent, useState } from "react";

type RollbackTarget = {
  publicationRecordId: string;
  externalObjectId: string;
  externalRevisionId?: string;
  verificationStatus: string;
  publishedAt?: string | null;
};

export function GmpPublicationRollbackDialog({
  publicationId,
  targets,
  rollbackCapable,
  onRolledBack,
}: {
  publicationId: string;
  targets: RollbackTarget[];
  rollbackCapable: boolean;
  onRolledBack: () => Promise<void> | void;
}) {
  const [target, setTarget] = useState(targets[0]?.externalRevisionId ?? "");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    const response = await fetch(`/api/gmp/publishing/publications/${publicationId}/rollback`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rollbackTargetRevisionId: target, reason }),
    }).catch(() => null);

    if (!response?.ok) {
      setStatus("Rollback failed.");
      return;
    }

    setStatus("Rollback submitted.");
    setReason("");
    await onRolledBack();
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <h3 className="text-sm font-semibold text-white">Rollback Publication</h3>
      <p className="mt-1 text-xs text-zinc-400">Rollback capability: {rollbackCapable ? "supported" : "unsupported"}</p>
      <label className="mt-2 block text-xs uppercase tracking-[0.2em] text-zinc-500">Target prior publication</label>
      <select value={target} onChange={(event) => setTarget(event.target.value)} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white">
        {targets.map((entry) => (
          <option key={entry.publicationRecordId} value={entry.externalRevisionId ?? ""}>
            {entry.publicationRecordId} • {entry.externalObjectId} • {entry.verificationStatus}
          </option>
        ))}
      </select>
      <label className="mt-2 block text-xs uppercase tracking-[0.2em] text-zinc-500">Rollback reason</label>
      <textarea required value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-sm text-white" rows={3} />
      <button type="submit" className="mt-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-zinc-950">Submit Rollback</button>
      {status ? <p className="mt-2 text-xs text-zinc-300">{status}</p> : null}
    </form>
  );
}
