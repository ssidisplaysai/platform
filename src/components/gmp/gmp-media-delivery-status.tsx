import React from "react";

type MediaManifest = {
  items?: Array<Record<string, unknown>>;
};

export function GmpMediaDeliveryStatus({ mediaManifest }: { mediaManifest: MediaManifest | null | undefined }) {
  const items = mediaManifest?.items ?? [];

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="text-lg font-semibold text-white">Media Delivery Diagnostics</h2>
      {items.length === 0 ? <p className="mt-2 text-sm text-zinc-400">No media manifest items are currently available.</p> : null}
      <div className="mt-3 space-y-2">
        {items.map((entry, index) => (
          <div key={index} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-sm text-zinc-200">Asset: {String(entry.mediaReferenceId ?? "unknown")}</p>
            <p className="text-xs text-zinc-400">Role: {String(entry.role ?? "unknown")} • Required: {String(entry.required ?? false)}</p>
            <p className="text-xs text-zinc-400">Checksum: {String(entry.checksum ?? "unknown")}</p>
            <p className="text-xs text-zinc-400">Upload: {String(entry.uploadStatus ?? "unknown")} • Remote media ID: {String(entry.remoteMediaId ?? "unknown")}</p>
            <p className="text-xs text-zinc-400">Remote URL: {String(entry.remoteUrl ?? "unknown")}</p>
            <p className="text-xs text-zinc-400">Featured media: {String(entry.featuredMediaStatus ?? "unknown")} • Body insertion: {String(entry.bodyInsertionStatus ?? "unknown")}</p>
            <p className="text-xs text-zinc-400">Failure category: {String(entry.failureCategory ?? "none")} • Retryable: {String(entry.retryable ?? "unknown")}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
