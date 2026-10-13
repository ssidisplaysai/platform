"use client";

import Link from "next/link";
import { useState } from "react";
import type { SiteNavigationReview } from "./site-navigation-review-repository";

export function SiteNavigationReviewWorkflow({ initialReview, initialNext, site }: { initialReview: SiteNavigationReview; initialNext: { action: string; label: string; detail: string; route: string }; site: { organizationId: string; siteId: string } }) {
  const [review, setReview] = useState(initialReview);
  const [next, setNext] = useState(initialNext);
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(confirm: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/sites/${encodeURIComponent(site.siteId)}/site-build`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-gcp-roles": "ops_manager", "x-gcp-organization-id": site.organizationId, "x-gcp-site-id": site.siteId },
        body: JSON.stringify({ confirm, navigationReviewId: review.navigationReviewId, instructions }),
      });
      const payload = await response.json() as { workspace?: { currentNavigationReview: SiteNavigationReview; next: typeof next }; error?: string };
      if (!response.ok || !payload.workspace?.currentNavigationReview) throw new Error(payload.error ?? "Navigation review action failed.");
      setReview(payload.workspace.currentNavigationReview);
      setNext(payload.workspace.next);
      setInstructions("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Navigation review action failed.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="space-y-6">
    <header className="border border-zinc-800 bg-zinc-950 p-6">
      <p className="text-xs font-semibold uppercase text-red-400">Navigation Review</p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold text-white">Proposed site navigation</h1><p className="mt-2 text-sm text-zinc-300">Review the approved site architecture as a menu proposal. No WordPress menu is changed by this workspace.</p></div><span className="text-xs font-semibold text-amber-300">{review.status.replaceAll("_", " ")}</span></div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4"><div><dt className="text-zinc-500">Revision</dt><dd className="text-white">{review.revision}</dd></div><div><dt className="text-zinc-500">Top-level items</dt><dd className="text-white">{review.items.length}</dd></div><div><dt className="text-zinc-500">Footer items</dt><dd className="text-white">{review.footerLinks.length}</dd></div><div><dt className="text-zinc-500">Publication</dt><dd className="text-amber-300">DISABLED</dd></div></dl>
    </header>
    <section className="border border-zinc-800 bg-zinc-950"><header className="border-b border-zinc-800 p-5"><h2 className="font-semibold text-white">Header navigation proposal</h2></header><ol className="divide-y divide-zinc-800">{review.items.map((item, index) => <li key={`${item.href}-${index}`} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase text-zinc-500">Position {index + 1}</p><h3 className="mt-1 font-semibold text-white">{item.label}</h3><p className="mt-1 font-mono text-xs text-zinc-400">{item.href}</p></div><span className="text-xs text-zinc-400">{item.children.length} child items</span></div>{item.children.length ? <ol className="mt-4 grid gap-2 sm:grid-cols-2">{item.children.map((child, childIndex) => <li key={`${child.href}-${childIndex}`} className="border border-zinc-800 p-3"><p className="text-xs text-zinc-500">{index + 1}.{childIndex + 1}</p><p className="font-semibold text-zinc-200">{child.label}</p><p className="mt-1 font-mono text-xs text-zinc-500">{child.href}</p></li>)}</ol> : null}</li>)}</ol></section>
    <section className="border border-zinc-800 bg-zinc-950 p-5"><h2 className="font-semibold text-white">Footer navigation proposal</h2><ol className="mt-3 grid gap-2 sm:grid-cols-3">{review.footerLinks.map((item, index) => <li key={`${item.href}-${index}`} className="border border-zinc-800 p-3"><p className="text-xs text-zinc-500">Position {index + 1}</p><p className="font-semibold text-zinc-200">{item.label}</p><p className="mt-1 font-mono text-xs text-zinc-500">{item.href}</p></li>)}</ol></section>
    {review.status === "APPROVED" ? <section className="border-l-4 border-emerald-500 bg-emerald-950/20 p-5"><p className="text-xs font-semibold uppercase text-emerald-300">Navigation Approved</p><h2 className="mt-2 text-xl font-semibold text-white">WordPress menu synchronization remains separate.</h2><p className="mt-2 text-sm text-zinc-300">{next.detail}</p><Link href={next.route} className="mt-4 inline-block bg-red-600 px-5 py-3 text-sm font-semibold text-white">{next.label}</Link></section> : <section className="border border-zinc-800 bg-zinc-950 p-5"><h2 className="font-semibold text-white">Owner navigation decision</h2><div className="mt-3 flex flex-wrap gap-2"><button disabled={busy || review.status !== "READY_FOR_OWNER_REVIEW"} onClick={() => act("APPROVE_NAVIGATION")} className="bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">APPROVE NAVIGATION</button><button disabled={busy || review.status !== "READY_FOR_OWNER_REVIEW"} onClick={() => act("REQUEST_NAVIGATION_CHANGES")} className="border border-zinc-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">REQUEST CHANGES</button><button disabled={busy || !instructions.trim()} onClick={() => act("REASSEMBLE_NAVIGATION")} className="border border-red-800 px-4 py-3 text-sm font-semibold text-red-200 disabled:opacity-40">REGENERATE / REASSEMBLE WITH INSTRUCTIONS</button></div><textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={3} placeholder="Describe ordering, grouping, labels, or footer-navigation changes" className="mt-3 w-full border border-zinc-700 bg-zinc-900 p-3 text-sm text-white" />{error ? <p role="alert" className="mt-3 text-sm text-red-300">{error}</p> : null}</section>}
  </section>;
}
