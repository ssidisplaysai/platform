"use client";

import { useEffect, useState } from "react";
import type { GlwCampaign } from "./campaign-types";
import type { GlwCampaignKnowledgePack } from "./campaign-reference-types";

type ReferenceJob = Record<string, unknown> & {
  jobId?: string;
  status?: string;
  qaStatus?: string | null;
  wordCount?: number | null;
  wordpressObjectId?: string | null;
  wordpressStatus?: string | null;
  wordpressUrl?: string | null;
  featuredImagePresent?: boolean | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  generatedDraft?: {
    title?: string;
    seoTitle?: string | null;
    focusKeyphrase?: string | null;
    excerpt?: string | null;
    contentHtml?: string;
  } | null;
};

type ReferenceApproval = {
  campaignId: string;
  stateCode: string;
  jobId: string;
  wordpressObjectId: string;
  approvedAt: string;
};

type ReferenceResult = Record<string, unknown> & {
  job?: ReferenceJob | null;
  approval?: ReferenceApproval | null;
  approved?: boolean;
  error?: string;
  recoveryError?: string | null;
};

export function GlwCampaignKnowledgePack({ campaign, organizationId }: { campaign: GlwCampaign; organizationId: string }) {
  const [pack, setPack] = useState<GlwCampaignKnowledgePack | null>(null);
  const [instructions, setInstructions] = useState("");
  const [provenance, setProvenance] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [role, setRole] = useState("content_reference");
  const [scope, setScope] = useState("campaign");
  const [message, setMessage] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [referenceState, setReferenceState] = useState("CA");
  const [generatingReference, setGeneratingReference] = useState(false);
  const [recoveringReference, setRecoveringReference] = useState(false);
  const [continuingReference, setContinuingReference] = useState(false);
  const [approvingReference, setApprovingReference] = useState(false);
  const [activatingCampaign, setActivatingCampaign] = useState(false);
  const [continuationAttemptedJobId, setContinuationAttemptedJobId] = useState<string | null>(null);
  const [referenceResult, setReferenceResult] = useState<ReferenceResult | null>(null);

  const headers = {
    "x-gcp-roles": "platform_admin",
    "x-gcp-organization-id": organizationId,
    "x-gcp-site-id": campaign.siteId,
  };

  const endpoint = `/api/glw/campaigns/${encodeURIComponent(campaign.campaignId)}/references`;
  const generateEndpoint = `/api/glw/campaigns/${encodeURIComponent(campaign.campaignId)}/generate-instructions`;
  const referenceEndpoint = `/api/glw/campaigns/${encodeURIComponent(campaign.campaignId)}/reference-page`;

  async function load() {
    const response = await fetch(endpoint, { headers });
    if (!response.ok) return;

    const payload = await response.json() as {
      knowledgePack: GlwCampaignKnowledgePack | null;
    };

    setPack(payload.knowledgePack);
    setInstructions(payload.knowledgePack?.instructions ?? "");
  }

  async function recoverReferencePage(refresh: boolean) {
    setRecoveringReference(true);

    try {
      const response = await fetch(
        `${referenceEndpoint}?stateCode=${encodeURIComponent(referenceState)}${refresh ? "&refresh=true" : ""}`,
        {
          headers,
          cache: "no-store",
        },
      );

      const payload = await response.json() as ReferenceResult;

      if (!response.ok) {
        setMessage(payload.error ?? "Unable to recover the reference-page job.");
        return;
      }

      if (payload.job) {
        setReferenceResult(payload);
      }
    } finally {
      setRecoveringReference(false);
    }
  }

  useEffect(() => {
    void load();
    void recoverReferencePage(false);
  }, [campaign.campaignId, referenceState]);

  async function approveInstructions() {
    setMessage(null);

    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ instructions }),
    });

    if (!response.ok) {
      setMessage("Unable to save campaign instructions.");
      return;
    }

    const payload = await response.json() as {
      knowledgePack: GlwCampaignKnowledgePack;
    };

    setPack(payload.knowledgePack);
    setMessage("Campaign instructions approved and saved.");
  }

  async function generateInstructions() {
    setGenerating(true);
    setMessage(null);
    setProvenance(null);

    const response = await fetch(generateEndpoint, {
      method: "POST",
      headers,
    });

    const payload = await response.json() as {
      instructions?: string;
      provenance?: string;
      error?: string;
    };

    if (!response.ok || !payload.instructions) {
      setMessage(payload.error ?? "Unable to generate campaign instructions.");
      setGenerating(false);
      return;
    }

    setInstructions(payload.instructions);
    setProvenance(payload.provenance ?? null);
    setMessage("AI instructions generated. Review and edit them, then approve before reference-page generation.");
    setGenerating(false);
  }

  async function upload() {
    if (!file) return;

    setMessage(null);

    const form = new FormData();
    form.append("file", file);
    form.append("role", role);
    form.append("scope", scope);

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: form,
    });

    if (!response.ok) {
      const payload = await response.json();
      setMessage(payload.error ?? "Upload failed.");
      return;
    }

    setFile(null);
    setMessage("Reference added to campaign knowledge pack.");
    await load();
  }

  async function generateReferencePage() {
    setGeneratingReference(true);
    setMessage(null);
    setReferenceResult(null);
    setContinuationAttemptedJobId(null);

    try {
      const response = await fetch(referenceEndpoint, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stateCode: referenceState,
        }),
      });

      const payload = await response.json() as ReferenceResult;

      setReferenceResult(payload);

      if (!response.ok) {
        setMessage(payload.error ?? "Reference page generation did not complete.");
      } else {
        setMessage("Reference generation started. Genesis will recover the same job automatically until the draft is ready.");
      }
    } finally {
      setGeneratingReference(false);
    }
  }

  async function approveReferencePage(jobId: string) {
    setApprovingReference(true);
    setMessage(null);

    try {
      const response = await fetch(referenceEndpoint, {
        method: "PATCH",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stateCode: referenceState,
          jobId,
        }),
      });

      const payload = await response.json() as ReferenceResult;

      setReferenceResult(payload);

      if (!response.ok) {
        setMessage(payload.error ?? "Reference approval failed.");
        return;
      }

      setMessage("Reference approved. This exact job and WordPress draft are now the campaign reference authority.");
    } finally {
      setApprovingReference(false);
    }
  }

  async function activateCampaign() {
    setActivatingCampaign(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/glw/campaigns/${campaign.campaignId}/activate`,
        {
          method: "POST",
          headers,
        },
      );

      const payload = await response.json() as {
        campaign?: {
          status?: string;
        };
        activation?: {
          totalTargets?: number;
          referenceComplete?: number;
          queued?: number;
          pagesPerDay?: number;
        };
        error?: string;
        errors?: string[];
      };

      if (!response.ok) {
        setMessage(
          payload.errors?.join(" ")
          ?? payload.error
          ?? "Campaign activation failed.",
        );
        return;
      }

      setMessage(
        `Campaign activated. ${payload.activation?.queued ?? 0} production targets queued at ${payload.activation?.pagesPerDay ?? campaign.pagesPerDay}/day. No pages were dispatched during activation.`,
      );

      window.setTimeout(() => {
        window.location.reload();
      }, 800);
    } finally {
      setActivatingCampaign(false);
    }
  }

  async function continueReferencePage(jobId: string) {
    setContinuingReference(true);
    setContinuationAttemptedJobId(jobId);

    try {
      const response = await fetch(referenceEndpoint, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stateCode: referenceState,
          action: "continue",
          jobId,
        }),
      });

      const payload = await response.json() as ReferenceResult;

      setReferenceResult(payload);

      if (!response.ok) {
        setMessage(payload.error ?? "Reference draft continuation did not complete.");
        return;
      }

      if (payload.job?.status === "COMPLETE") {
        setMessage("Reference page is ready for review. The WordPress page remains a draft.");
      }
    } finally {
      setContinuingReference(false);
    }
  }

  const referenceCount = pack?.references.length ?? 0;
  const instructionsApproved = Boolean(pack?.instructions.trim()) && pack?.instructions === instructions;
  const stateOptions = campaign.stateCodes.map((code) => ({
    code,
    label: code === "CA" ? "California" : code,
  }));

  const job = referenceResult?.job ?? null;
  const jobStatus = String(job?.status ?? "");
  const jobId = typeof job?.jobId === "string" ? job.jobId : null;

  useEffect(() => {
    if (!jobId) return;

    if (
      jobStatus === "CONTENT_READY"
      && !continuingReference
      && continuationAttemptedJobId !== jobId
    ) {
      void continueReferencePage(jobId);
      return;
    }

    if (
      jobStatus === "QUEUED"
      || jobStatus === "DISPATCHED"
      || jobStatus === "DISCOVERING_EXECUTION"
      || jobStatus === "RUNNING"
    ) {
      const timer = window.setTimeout(
        () => void recoverReferencePage(true),
        4000,
      );

      return () => window.clearTimeout(timer);
    }
  }, [
    jobId,
    jobStatus,
    continuingReference,
    continuationAttemptedJobId,
  ]);

  const generatedDraft = job?.generatedDraft ?? null;

  let wordpressEditUrl: string | null = null;

  if (
    job?.wordpressUrl
    && job?.wordpressObjectId
  ) {
    try {
      const url = new URL(String(job.wordpressUrl));
      wordpressEditUrl = `${url.origin}/wp-admin/post.php?post=${encodeURIComponent(String(job.wordpressObjectId))}&action=edit`;
    } catch {
      wordpressEditUrl = null;
    }
  }

  const generationBusy =
    generatingReference
    || recoveringReference
    || continuingReference
    || approvingReference
    || jobStatus === "QUEUED"
    || jobStatus === "DISPATCHED"
    || jobStatus === "DISCOVERING_EXECUTION"
    || jobStatus === "RUNNING"
    || jobStatus === "CONTENT_READY";

  return (
    <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="font-semibold text-white">Campaign Knowledge Pack</h4>
          <p className="mt-1 text-xs text-zinc-500">
            Add factual and visual references first, then let Genesis draft the campaign instructions for your approval.
          </p>
        </div>
        <span className="text-xs text-zinc-400">{referenceCount} files</span>
      </div>

      <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-red-400">1. References</p>
        <p className="mt-1 text-xs text-zinc-500">
          Classify each upload so Genesis knows whether it is factual authority, product imagery, or visual inspiration.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-xs text-zinc-300">
            Reference Role
            <select value={role} onChange={(e) => setRole(e.target.value)} className="mt-2 h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-white">
              <option value="authoritative_fact">Authoritative factual source</option>
              <option value="content_reference">Content reference</option>
              <option value="product_image">Product image reference</option>
              <option value="image_style">Image style reference</option>
            </select>
          </label>

          <label className="text-xs text-zinc-300">
            Scope
            <select value={scope} onChange={(e) => setScope(e.target.value)} className="mt-2 h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-white">
              <option value="campaign">Entire campaign</option>
              <option value="reference_only">Reference page only</option>
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".pdf,.doc,.docx,.txt,.md,image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-xs text-zinc-300"
          />
          <button type="button" disabled={!file} onClick={upload} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">
            Upload Reference
          </button>
        </div>

        {pack?.references.length ? (
          <div className="mt-4 space-y-2">
            {pack.references.map((reference) => (
              <div key={reference.referenceId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">
                <span className="text-white">{reference.fileName}</span>
                <span className="text-zinc-500">
                  {reference.role.replaceAll("_", " ")} · {reference.scope.replaceAll("_", " ")}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-xs text-zinc-500">
            Upload at least one reference before using AI-assisted instructions.
          </p>
        )}
      </section>

      <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-red-400">2. Campaign Instructions</p>
            <p className="mt-1 text-xs text-zinc-500">
              Generate a grounded starting point from the campaign configuration and uploaded references, or write the instructions manually.
            </p>
          </div>

          <button type="button" disabled={referenceCount === 0 || generating} onClick={generateInstructions} className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">
            {generating ? "Generating..." : "Generate Instructions with AI"}
          </button>
        </div>

        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={9}
          className="mt-4 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-sm text-white"
        />

        {provenance ? (
          <p className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-400">
            {provenance}
          </p>
        ) : null}

        <button type="button" disabled={!instructions.trim()} onClick={approveInstructions} className="mt-3 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-white hover:border-red-500 disabled:opacity-40">
          Approve Instructions
        </button>
      </section>

      {message ? (
        <p className="mt-3 text-xs text-amber-300">{message}</p>
      ) : null}

      <section className="mt-4 border-t border-zinc-800 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-red-400">3. Reference Page</p>
        <p className="mt-1 text-xs text-zinc-500">
          Generate one state page through the draft-only GLW pipeline. Genesis now preserves and recovers the same reference job across refreshes.
        </p>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs text-zinc-300">
            Reference State
            <select
              value={referenceState}
              onChange={(e) => {
                setReferenceState(e.target.value);
                setReferenceResult(null);
                setContinuationAttemptedJobId(null);
              }}
              className="mt-2 h-10 min-w-48 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-white"
            >
              {stateOptions.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            disabled={!instructionsApproved || generationBusy || referenceState !== "CA"}
            onClick={generateReferencePage}
            className="h-10 rounded-lg bg-red-600 px-4 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {generationBusy ? "Recovering Reference..." : job?.status === "COMPLETE" ? "Regenerate Reference Content" : "Generate California Reference Page"}
          </button>
        </div>

        {!instructionsApproved ? (
          <p className="mt-2 text-xs text-zinc-500">
            Approve the current instructions to unlock reference generation.
          </p>
        ) : null}

        {referenceResult && job ? (
          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs">
            <div className="grid gap-2 md:grid-cols-4">
              <div>
                <span className="text-zinc-500">Status</span>
                <p className="text-white">{String(job.status ?? "Unknown")}</p>
              </div>
              <div>
                <span className="text-zinc-500">QA</span>
                <p className="text-white">{String(job.qaStatus ?? "—")}</p>
              </div>
              <div>
                <span className="text-zinc-500">Words</span>
                <p className="text-white">{String(job.wordCount ?? "—")}</p>
              </div>
              <div>
                <span className="text-zinc-500">Featured Image</span>
                <p className="text-white">
                  {job.featuredImagePresent === true ? "Ready" : job.featuredImagePresent === false ? "Not ready" : "—"}
                </p>
              </div>
            </div>

            {job.status === "COMPLETE" ? (
              <div className="mt-4 rounded-lg border border-emerald-900/60 bg-emerald-950/20 p-3">
                <p className="font-semibold text-emerald-300">
                  {referenceResult.approved ? "Reference Approved" : "Reference Ready"}
                </p>

                <p className="mt-1 text-zinc-400">
                  {referenceResult.approved
                    ? "This exact completed job and WordPress draft are locked as the approved campaign reference."
                    : "Genesis completed the persisted job. Review it, then approve this exact draft before campaign activation."}
                </p>

                {!referenceResult.approved && jobId ? (
                  <button
                    type="button"
                    disabled={approvingReference}
                    onClick={() => void approveReferencePage(jobId)}
                    className="mt-3 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    {approvingReference ? "Approving..." : "Approve Reference"}
                  </button>
                ) : null}

                {referenceResult.approved && referenceResult.approval ? (
                  <>
                    <p className="mt-2 text-[11px] text-emerald-400">
                      Approved {new Date(referenceResult.approval.approvedAt).toLocaleString()}
                    </p>

                    <div className="mt-4 border-t border-emerald-900/60 pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                        Production Activation
                      </p>

                      <p className="mt-1 text-xs text-zinc-400">
                        Activation creates the 50-state target queue. California remains the approved completed reference. The other states are queued only; activation does not generate, publish, or dispatch them.
                      </p>

                      <button
                        type="button"
                        disabled={activatingCampaign}
                        onClick={() => void activateCampaign()}
                        className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
                      >
                        {activatingCampaign
                          ? "Activating..."
                          : `Activate Campaign - ${campaign.pagesPerDay}/day`}
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            {wordpressEditUrl ? (
              <a
                href={wordpressEditUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-red-400 underline"
              >
                Edit WordPress Draft
              </a>
            ) : null}

            {job.errorMessage ? (
              <p className="mt-3 text-amber-300">
                {String(job.errorMessage)}
              </p>
            ) : null}

            {referenceResult.recoveryError ? (
              <p className="mt-3 text-amber-300">
                {String(referenceResult.recoveryError)}
              </p>
            ) : null}

            {generatedDraft ? (
              <div className="mt-5 border-t border-zinc-800 pt-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <span className="text-zinc-500">Generated Title</span>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {generatedDraft.title ?? "—"}
                    </p>
                  </div>

                  <div>
                    <span className="text-zinc-500">SEO Title</span>
                    <p className="mt-1 text-white">
                      {generatedDraft.seoTitle ?? "—"}
                    </p>
                  </div>
                </div>

                {generatedDraft.excerpt ? (
                  <div className="mt-3">
                    <span className="text-zinc-500">Excerpt</span>
                    <p className="mt-1 text-zinc-300">
                      {generatedDraft.excerpt}
                    </p>
                  </div>
                ) : null}

                {generatedDraft.contentHtml ? (
                  <div className="mt-4">
                    <p className="mb-2 font-semibold text-white">
                      Generated Reference Preview
                    </p>
                    <iframe
                      title="Generated reference preview"
                      sandbox=""
                      srcDoc={generatedDraft.contentHtml}
                      className="h-[600px] w-full rounded-lg border border-zinc-700 bg-white"
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}