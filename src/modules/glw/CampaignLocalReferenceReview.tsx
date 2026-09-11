"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import type { GlwLocalReferenceDraft } from "./campaign-local-reference-repository";

export function CampaignLocalReferenceReview(props: {
  organizationId: string;
  siteId: string;
  campaignId: string;
  requestRoles: readonly string[];
  reference: GlwLocalReferenceDraft;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function request(method: "POST" | "PATCH", operation: string, instructions?: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/glw/campaigns/${props.campaignId}/local-reference`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-gcp-roles": props.requestRoles.join(","),
          "x-gcp-organization-id": props.organizationId,
          "x-gcp-site-id": props.siteId,
        },
        body: JSON.stringify({ operation, instructions }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Reference action failed.");
      setMessage(operation === "APPROVE_LOCAL_REFERENCE"
        ? "Approved for a separately authorized WordPress draft materialization. Canonical reference approval is still pending."
        : "Reference review state updated.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reference action failed.");
    } finally {
      setBusy(false);
    }
  }

  function askForChanges(operation: "REQUEST_CHANGES" | "REGENERATE_WITH_INSTRUCTIONS") {
    const instructions = globalThis.prompt?.("Describe the required reference changes.")?.trim();
    if (!instructions) return;
    void request(operation === "REQUEST_CHANGES" ? "PATCH" : "POST", operation, instructions);
  }

  return (
    <section className="mt-5 border-t border-zinc-800 pt-4" aria-label="Campaign reference review">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-sky-300">Reference review</p>
          <h4 className="mt-1 font-semibold text-white">{props.reference.title}</h4>
          <p className="mt-1 text-xs text-zinc-500">Revision {props.reference.revision} · {props.reference.status.replaceAll("_", " ")}</p>
        </div>
        <span className="border border-sky-800 px-2 py-1 text-xs text-sky-200">Genesis local · not published</span>
      </div>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-[9rem_1fr]">
        <dt className="text-zinc-500">SEO title</dt><dd className="text-zinc-200">{props.reference.seoTitle}</dd>
        <dt className="text-zinc-500">Meta description</dt><dd className="text-zinc-200">{props.reference.metaDescription}</dd>
        <dt className="text-zinc-500">H1</dt><dd className="text-zinc-200">{props.reference.h1}</dd>
      </dl>
      <div className="mt-4 space-y-4">
        {props.reference.sections.map((section) => (
          <div key={section.heading}>
            <h5 className="text-sm font-semibold text-white">{section.heading}</h5>
            <div className="mt-1 text-sm leading-6 text-zinc-300" dangerouslySetInnerHTML={{ __html: section.bodyHtml }} />
          </div>
        ))}
      </div>
      <div className="mt-4">
        <p className="text-xs font-bold uppercase text-zinc-500">Internal links</p>
        <ul className="mt-2 space-y-1 text-sm text-zinc-300">
          {props.reference.internalLinks.map((link) => <li key={link.url}>{link.label}: {link.url}</li>)}
        </ul>
      </div>
      <div className="mt-4 border border-zinc-800 p-3 text-sm">
        <p className="font-semibold text-white">Image requirement</p>
        <p className="mt-1 text-zinc-300">{props.reference.image.status.replaceAll("_", " ")} · {props.reference.image.classification}</p>
        <p className="mt-1 text-zinc-500">{props.reference.image.altText}</p>
        <div className="mt-3 flex gap-2">
          <button type="button" disabled title="Requires a separately authorized governed image-generation action" className="border border-zinc-700 px-3 py-2 text-xs text-zinc-600">Generate Image</button>
          <button type="button" disabled title="Upload through the governed owner-asset workflow" className="border border-zinc-700 px-3 py-2 text-xs text-zinc-600">Replace With Owner Asset</button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={busy || props.reference.status !== "READY_FOR_OWNER_REVIEW"} onClick={() => request("PATCH", "APPROVE_LOCAL_REFERENCE")} className="border border-emerald-600 px-3 py-2 text-xs font-semibold text-emerald-200 disabled:border-zinc-700 disabled:text-zinc-600">Approve Reference</button>
        <button type="button" disabled={busy} onClick={() => askForChanges("REQUEST_CHANGES")} className="border border-amber-600 px-3 py-2 text-xs font-semibold text-amber-200 disabled:text-zinc-600">Request Changes</button>
        <button type="button" disabled={busy} onClick={() => request("POST", "REGENERATE")} className="border border-zinc-600 px-3 py-2 text-xs text-zinc-200 disabled:text-zinc-600">Regenerate</button>
        <button type="button" disabled={busy} onClick={() => askForChanges("REGENERATE_WITH_INSTRUCTIONS")} className="border border-zinc-600 px-3 py-2 text-xs text-zinc-200 disabled:text-zinc-600">Regenerate With Instructions</button>
      </div>
      <p className="mt-3 text-xs text-zinc-500">Local approval does not approve the canonical WordPress reference. WordPress draft materialization and canonical approval remain separate owner-controlled steps.</p>
      {message ? <p className="mt-3 text-sm text-zinc-300" role="status">{message}</p> : null}
      <details className="mt-4 text-xs text-zinc-500">
        <summary className="cursor-pointer text-zinc-400">Advanced provenance</summary>
        <p className="mt-2">Parent: {props.reference.provenance.parentCampaignId}</p>
        <p>Knowledge pack revision: {props.reference.provenance.knowledgePackRevision}</p>
        <ul className="mt-1 space-y-1">{props.reference.provenance.authorityReferences.map((reference) => <li key={reference}>{reference}</li>)}</ul>
      </details>
    </section>
  );
}
