"use client";

import { useState } from "react";

type Props = {
  organizationId: string;
  siteId: string;
  defaultJobId?: string;
};

type RefreshPayload = {
  ok?: boolean;
  jobId?: string;
  wordpressObjectId?: string;
  wordpressStatus?: string;
  seoMetadataAttempted?: boolean;
  seoMetadataAccepted?: boolean;
  inserted?: {
    productAuthorityLink: boolean;
    corporateLink: boolean;
    outboundAuthorityLink: boolean;
  };
  featuredImagePreserved?: boolean;
  imageGenerationPerformed?: boolean;
  publicationPerformed?: boolean;
  error?: string;
};

export function GlwExistingDraftSeoRefresh({
  organizationId,
  siteId,
  defaultJobId = "",
}: Props) {
  const [jobId, setJobId] = useState(defaultJobId);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshSeo() {
    const exactJobId = jobId.trim();
    if (!exactJobId) return;

    const confirmed = window.confirm(
      `Refresh SEO on existing COMPLETE draft job ${exactJobId}? Content generation, image generation, and publication remain blocked.`,
    );

    if (!confirmed) return;

    setRunning(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/glw/page-generation/seo-refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gcp-roles": "platform_admin",
          "x-gcp-organization-id": organizationId,
          "x-gcp-site-id": siteId,
        },
        body: JSON.stringify({
          jobId: exactJobId,
          confirm: "REFRESH_EXISTING_DRAFT_SEO",
        }),
      });

      const payload = await response.json().catch(() => null) as RefreshPayload | null;

      if (!response.ok || !payload?.ok) {
        setError(payload?.error ?? `SEO refresh failed (HTTP ${response.status}).`);
        return;
      }

      setMessage(
        [
          `SEO refresh complete for WordPress ${payload.wordpressObjectId ?? "unknown"}.`,
          `Yoast metadata attempted: ${payload.seoMetadataAttempted === true ? "yes" : "no"}.`,
          `Accepted by WordPress response: ${payload.seoMetadataAccepted === true ? "yes" : "no"}.`,
          `SSI link: ${payload.inserted?.corporateLink === true ? "added" : "already present"}.`,
          `Outbound authority link: ${payload.inserted?.outboundAuthorityLink === true ? "added" : "already present"}.`,
          `Image generation: ${payload.imageGenerationPerformed === true ? "yes" : "no"}.`,
          `Publication: ${payload.publicationPerformed === true ? "yes" : "no"}.`,
        ].join(" "),
      );
    } catch {
      setError("SEO refresh request failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
      <p className="text-xs uppercase tracking-[0.25em] text-red-400">Existing Draft Maintenance</p>
      <h2 className="mt-2 text-lg font-semibold text-white">Refresh SEO on Existing Draft</h2>
      <p className="mt-1 max-w-3xl text-sm text-zinc-400">
        Reuse an exact completed GLW draft artifact, apply the certified SEO enrichment layer, and update that exact WordPress draft without regenerating content or images.
      </p>

      <div className="mt-5 flex flex-col gap-3 md:flex-row">
        <input
          value={jobId}
          onChange={(event) => setJobId(event.target.value)}
          placeholder="Exact COMPLETE GLW job ID"
          className="h-11 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-white"
        />
        <button
          type="button"
          onClick={() => void refreshSeo()}
          disabled={running || !jobId.trim()}
          className="rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {running ? "Refreshing SEO..." : "Refresh SEO on Existing Draft"}
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-300">{error}</p>
      ) : null}
      {message ? (
        <p className="mt-4 rounded-lg border border-emerald-900/60 bg-emerald-950/30 p-3 text-sm text-emerald-300">{message}</p>
      ) : null}
    </section>
  );
}
