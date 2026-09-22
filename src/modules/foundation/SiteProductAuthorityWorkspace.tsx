"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { evaluateProductAuthorityCompletion } from "./site-product-authority-completion";
import {
  type AuthorityCandidateType,
  type AuthorityDecision,
  type SiteProductServiceAuthority,
  type SiteSource,
  type SiteSourceRole,
} from "./site-product-authority-repository";

type AuthorityWorkspace = {
  sources: SiteSource[];
  candidates: SiteProductServiceAuthority[];
  progress: { proposed: number; approved: number; needReview: number };
};

type Props = { organizationId: string; siteId: string };

const SOURCE_ROLES: Array<{ value: SiteSourceRole; label: string }> = [
  { value: "BUSINESS_FACTS", label: "Business facts" },
  { value: "PRODUCT_SERVICE_AUTHORITY", label: "Product / service authority" },
  { value: "TECHNICAL_SPECIFICATION", label: "Technical / specification source" },
  { value: "CREATIVE_REFERENCE", label: "Creative reference" },
  { value: "OTHER_REFERENCE", label: "Other reference" },
];

function headers(props: Props) {
  return {
    "content-type": "application/json",
    "x-gcp-roles": "ops_manager",
    "x-gcp-organization-id": props.organizationId,
    "x-gcp-site-id": props.siteId,
  };
}

export function SiteProductAuthorityWorkspace(props: Props) {
  const organizationId = props.organizationId;
  const siteId = props.siteId;

  const [workspace, setWorkspace] = useState<AuthorityWorkspace | null>(null);
  const [strategyRevision, setStrategyRevision] = useState<number | null>(null);
  const [creativeRevision, setCreativeRevision] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sourceMode, setSourceMode] = useState<"URL" | "UPLOAD" | "OWNER">("URL");
  const [sourceRole, setSourceRole] = useState<SiteSourceRole>("PRODUCT_SERVICE_AUTHORITY");
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [file, setFile] = useState<File | null>(null);

  async function load() {
    const response = await fetch(`/api/sites/${encodeURIComponent(props.siteId)}/product-authority`, {
      headers: headers(props),
      cache: "no-store",
    });
    const payload = (await response.json()) as {
      workspace?: AuthorityWorkspace;
      strategy?: { revision: number };
      creative?: { revision: number };
      error?: string;
    };
    if (!response.ok || !payload.workspace) throw new Error(payload.error ?? "Unable to load authority workspace.");
    setWorkspace(payload.workspace);
    setStrategyRevision(payload.strategy?.revision ?? null);
    setCreativeRevision(payload.creative?.revision ?? null);
  }

  useEffect(() => {
    let active = true;
    fetch(`/api/sites/${encodeURIComponent(siteId)}/product-authority`, {
      headers: headers({ organizationId, siteId }),
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          workspace?: AuthorityWorkspace;
          strategy?: { revision: number };
          creative?: { revision: number };
          error?: string;
        };
        if (!response.ok || !payload.workspace) throw new Error(payload.error ?? "Unable to load authority workspace.");
        if (active) {
          setWorkspace(payload.workspace);
          setStrategyRevision(payload.strategy?.revision ?? null);
          setCreativeRevision(payload.creative?.revision ?? null);
        }
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load authority workspace.");
      });

    return () => {
      active = false;
    };
  }, [organizationId, siteId]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/sites/${encodeURIComponent(props.siteId)}/product-authority`, {
        method: "POST",
        headers: headers(props),
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { workspace?: AuthorityWorkspace; error?: string };
      if (!response.ok || !payload.workspace) throw new Error(payload.error ?? "Authority action failed.");
      setWorkspace(payload.workspace);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authority action failed.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addSource() {
    if (sourceMode === "UPLOAD") {
      if (!file) return;
      setBusy(true);
      setError(null);
      try {
        const form = new FormData();
        form.set("file", file);
        form.set("sourceRole", sourceRole);
        form.set("label", label);
        const response = await fetch(`/api/sites/${encodeURIComponent(props.siteId)}/product-authority/sources`, {
          method: "POST",
          headers: {
            "x-gcp-roles": "ops_manager",
            "x-gcp-organization-id": props.organizationId,
            "x-gcp-site-id": props.siteId,
          },
          body: form,
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Upload failed.");
        await load();
        setFile(null);
        setLabel("");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Upload failed.");
      } finally {
        setBusy(false);
      }
      return;
    }

    const action = sourceMode === "URL" ? "ADD_URL_SOURCE" : "ADD_OWNER_KNOWLEDGE";
    const success = await post({
      action,
      sourceRole,
      label,
      ...(sourceMode === "URL" ? { url: value } : { statement: value }),
    });
    if (success) {
      setLabel("");
      setValue("");
    }
  }

  async function proposeOfferingsFromSources() {
    await post({ action: "PROPOSE_CANDIDATES_FROM_SOURCES" });
  }

  if (!workspace) {
    return (
      <section className="border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-400">
        Loading Product / Service Authority...{error ? ` ${error}` : ""}
      </section>
    );
  }

  const blockers = workspace.candidates.filter(
    (item) =>
      (item.decision === "APPROVED" || item.decision === "QUALIFIED")
      && item.protectedClaimBlockers.length > 0
      && item.authorityBasis !== "OWNER_ATTESTED_AND_EVIDENCE",
  );
  const complete = evaluateProductAuthorityCompletion({
    candidateCount: workspace.progress.proposed,
    approvedCount: workspace.progress.approved,
    needReview: workspace.progress.needReview,
    protectedBlockers: blockers.length,
  });

  const zeroCandidateState = workspace.progress.proposed === 0;

  return (
    <section className="space-y-6">
      <header className="border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs font-semibold uppercase text-red-400">Product / Service Authority</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Confirm what this site actually offers</h1>
        <p className="mt-2 text-sm text-zinc-300">
          Your strategy and creative direction are approved. Review proposed offerings and establish the sources Genesis may trust.
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-zinc-500">Proposed</dt>
            <dd className="text-xl font-semibold text-white">{workspace.progress.proposed}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Approved</dt>
            <dd className="text-xl font-semibold text-emerald-300">{workspace.progress.approved}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Need review</dt>
            <dd className="text-xl font-semibold text-amber-300">{workspace.progress.needReview}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-zinc-500">Approved strategy revision {strategyRevision} - Approved creative revision {creativeRevision}</p>
      </header>

      <section className="border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="text-lg font-semibold text-white">Site Sources of Truth</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Store a source once and link it to multiple offerings. A source is never publishable or authoritative merely because it exists.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {([
            ["URL", "+ ADD URL"],
            ["UPLOAD", "+ UPLOAD SOURCE"],
            ["OWNER", "+ ADD OWNER KNOWLEDGE"],
          ] as const).map(([mode, text]) => (
            <button
              key={mode}
              type="button"
              aria-pressed={sourceMode === mode}
              onClick={() => setSourceMode(mode)}
              className="border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 aria-pressed:border-red-600 aria-pressed:text-white"
            >
              {text}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-zinc-400">
            Source label
            <input value={label} onChange={(event) => setLabel(event.target.value)} className="mt-1 h-10 w-full border border-zinc-700 bg-zinc-900 px-3 text-white" />
          </label>

          <label className="text-xs text-zinc-400">
            What is this source?
            <select value={sourceRole} onChange={(event) => setSourceRole(event.target.value as SiteSourceRole)} className="mt-1 h-10 w-full border border-zinc-700 bg-zinc-900 px-3 text-white">
              {SOURCE_ROLES.map((role) => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
          </label>

          {sourceMode === "UPLOAD" ? (
            <label className="text-xs text-zinc-400 sm:col-span-2">
              File
              <input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-1 block w-full border border-dashed border-zinc-700 p-4 text-zinc-300" />
            </label>
          ) : (
            <label className="text-xs text-zinc-400 sm:col-span-2">
              {sourceMode === "URL" ? "URL" : "What does the owner know?"}
              {sourceMode === "URL" ? (
                <input value={value} onChange={(event) => setValue(event.target.value)} placeholder="https://example.com/source" className="mt-1 h-10 w-full border border-zinc-700 bg-zinc-900 px-3 text-white" />
              ) : (
                <textarea value={value} onChange={(event) => setValue(event.target.value)} rows={3} className="mt-1 w-full border border-zinc-700 bg-zinc-900 p-2 text-white" />
              )}
            </label>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={addSource} className="bg-red-600 px-4 py-2 text-xs font-semibold text-white disabled:bg-zinc-700">
            {busy ? "SAVING..." : "SAVE SOURCE"}
          </button>
          <button type="button" disabled={busy} onClick={proposeOfferingsFromSources} className="border border-emerald-700 bg-emerald-950/20 px-4 py-2 text-xs font-semibold text-emerald-200 disabled:border-zinc-700 disabled:text-zinc-500">
            {busy ? "PROPOSING..." : "PROPOSE OFFERINGS FROM SOURCES"}
          </button>
        </div>

        {workspace.sources.length ? (
          <ul className="mt-4 space-y-2 text-xs text-zinc-300">
            {workspace.sources.map((source) => (
              <li key={source.sourceId} className="border border-zinc-800 p-3">
                <p className="font-semibold text-white">{source.label}</p>
                <p className="mt-1 text-zinc-400">{source.kind} - {source.sourceRole}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-zinc-400">No sources recorded yet.</p>
        )}
      </section>

      <section className="border border-zinc-800 bg-zinc-950">
        <header className="border-b border-zinc-800 p-5">
          <h2 className="text-lg font-semibold text-white">Product / Service Candidates</h2>
          <p className="mt-1 text-sm text-zinc-400">Proposed from approved strategy or owner-authorized sources. No candidate becomes authority until you decide it.</p>
        </header>

        {zeroCandidateState ? (
          <div className="p-5">
            <p className="text-xs font-semibold uppercase text-amber-300">NO OFFERINGS PROPOSED</p>
            <p className="mt-2 text-sm text-zinc-300">
              Add owner-authorized Product / Service Authority sources, then ask Genesis to propose reviewable offerings.
            </p>
            <button type="button" disabled={busy} onClick={proposeOfferingsFromSources} className="mt-4 border border-emerald-700 bg-emerald-950/20 px-4 py-2 text-xs font-semibold text-emerald-200 disabled:border-zinc-700 disabled:text-zinc-500">
              {busy ? "PROPOSING..." : "PROPOSE OFFERINGS FROM SOURCES"}
            </button>
          </div>
        ) : (
          workspace.candidates.map((candidate) => (
            <CandidateCard
              key={candidate.authorityId}
              organizationId={props.organizationId}
              siteId={props.siteId}
              candidate={candidate}
              sources={workspace.sources}
              busy={busy}
              onSave={post}
            />
          ))
        )}
      </section>

      {complete ? (
        <section className={`border p-5 ${blockers.length ? "border-amber-800 bg-amber-950/20" : "border-emerald-800 bg-emerald-950/20"}`}>
          <p className="text-xs font-semibold uppercase text-zinc-300">Product / Service Authority complete</p>
          {blockers.length ? (
            <>
              <h2 className="mt-2 text-lg font-semibold text-white">Protected facts still need proof</h2>
              <ul className="mt-2 list-disc pl-5 text-sm text-amber-200">
                {blockers.flatMap((item) => item.protectedClaimBlockers.map((blocker) => (
                  <li key={`${item.authorityId}-${blocker}`}>{item.displayName}: {blocker}</li>
                )))}
              </ul>
            </>
          ) : (
            <>
              <h2 className="mt-2 text-lg font-semibold text-white">Genesis now has approved business, strategy, creative, and product/service authority.</h2>
              <p className="mt-2 text-sm text-zinc-300">Site generation remains a separate owner-controlled stage and is not started here.</p>
              <Link href={`/sites/${encodeURIComponent(props.siteId)}`} className="mt-4 inline-block bg-emerald-700 px-4 py-3 text-sm font-semibold text-white">
                CONTINUE TO SITE BUILD / GENERATION READINESS
              </Link>
            </>
          )}
        </section>
      ) : (
        <section className="border border-amber-800 bg-amber-950/20 p-5">
          <p className="text-xs font-semibold uppercase text-amber-300">Authority review incomplete</p>
          <p className="mt-2 text-sm text-zinc-200">
            {workspace.progress.needReview > 0
              ? `${workspace.progress.needReview} candidates still need an owner decision.`
              : workspace.progress.approved === 0
                ? "At least one offering must be approved before authority can be complete."
                : "Resolve protected fact evidence before completion."}
          </p>
        </section>
      )}

      {error ? <div role="alert" className="border border-red-800 bg-red-950/20 p-4 text-sm text-red-200">{error}</div> : null}
    </section>
  );
}

function CandidateCard({
  organizationId,
  siteId,
  candidate,
  sources,
  busy,
  onSave,
}: {
  organizationId: string;
  siteId: string;
  candidate: SiteProductServiceAuthority;
  sources: SiteSource[];
  busy: boolean;
  onSave(body: Record<string, unknown>): Promise<boolean>;
}) {
  const [displayName, setDisplayName] = useState(candidate.displayName);
  const [type, setType] = useState<AuthorityCandidateType>(candidate.type);
  const [description, setDescription] = useState(candidate.description);
  const [limitations, setLimitations] = useState(candidate.limitations ?? "");
  const [ownerConfirmed, setOwnerConfirmed] = useState(Boolean(candidate.ownerAttestation));
  const [sourceIds, setSourceIds] = useState(candidate.sourceIds);
  const [previewingSource, setPreviewingSource] = useState<SiteSource | null>(null);

  function decide(decision: AuthorityDecision) {
    return onSave({
      action: "DECIDE_CANDIDATE",
      authorityId: candidate.authorityId,
      type,
      displayName,
      description,
      limitations,
      decision,
      ownerAttestation: ownerConfirmed
        ? `Owner confirms ${displayName} as a current offering${decision === "QUALIFIED" ? " subject to the recorded limitations" : ""}.`
        : "",
      sourceIds,
    });
  }

  return (
    <article className="border-b border-zinc-800 p-5 last:border-0">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-zinc-500">Strategy candidate</p>
          <h3 className="mt-1 font-semibold text-white">{candidate.strategyFamily}</h3>
        </div>
        <span className="text-xs font-semibold text-amber-300">{candidate.decision}</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-zinc-400">
          Display name
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-1 h-10 w-full border border-zinc-700 bg-zinc-900 px-3 text-white" />
        </label>
        <label className="text-xs text-zinc-400">
          Classification
          <select value={type} onChange={(event) => setType(event.target.value as AuthorityCandidateType)} className="mt-1 h-10 w-full border border-zinc-700 bg-zinc-900 px-3 text-white">
            <option value="PRODUCT">Product</option>
            <option value="SERVICE">Service</option>
            <option value="PRODUCT_FAMILY">Product family</option>
            <option value="SERVICE_FAMILY">Service family</option>
          </select>
        </label>
        <label className="text-xs text-zinc-400 sm:col-span-2">
          Concise description
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="mt-1 w-full border border-zinc-700 bg-zinc-900 p-2 text-white" />
        </label>
        <label className="text-xs text-zinc-400 sm:col-span-2">
          Limitations, if any
          <textarea value={limitations} onChange={(event) => setLimitations(event.target.value)} rows={2} className="mt-1 w-full border border-zinc-700 bg-zinc-900 p-2 text-white" />
        </label>
      </div>

      <fieldset className="mt-4">
        <legend className="text-xs font-semibold uppercase text-zinc-400">Supporting site sources</legend>
        {sources.length ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {sources.map((source) => (
              <div key={source.sourceId} className="border border-zinc-800 p-3 text-xs text-zinc-300">
                <label className="flex gap-2">
                  <input
                    type="checkbox"
                    checked={sourceIds.includes(source.sourceId)}
                    onChange={(event) => {
                      setSourceIds((current) =>
                        event.target.checked
                          ? [...new Set([...current, source.sourceId])]
                          : current.filter((item) => item !== source.sourceId));
                    }}
                  />
                  <span>
                    <span className="font-semibold text-white">{source.label}</span>
                    <span className="ml-1 text-zinc-500">{source.sourceRole}</span>
                  </span>
                </label>

                {source.kind === "UPLOAD" && source.assetId && source.mediaType?.startsWith("image/") ? (
                  <div className="mt-3 rounded border border-zinc-800 bg-zinc-900/30 p-2">
                    <EvidenceImageThumbnail
                      organizationId={organizationId}
                      siteId={siteId}
                      assetId={source.assetId}
                      fileName={source.originalFileName ?? source.label}
                    />
                    <button
                      type="button"
                      onClick={() => setPreviewingSource(source)}
                      className="mt-2 border border-zinc-700 px-2 py-1 text-[11px] font-semibold text-zinc-100"
                    >
                      Preview image evidence
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">No sources available yet.</p>
        )}
      </fieldset>

      <label className="mt-4 flex items-center gap-2 text-xs text-zinc-300">
        <input type="checkbox" checked={ownerConfirmed} onChange={(event) => setOwnerConfirmed(event.target.checked)} />
        Owner attests this candidate is currently offered
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => decide("APPROVED")} className="bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:bg-zinc-700">
          YES - APPROVE FOR SITE
        </button>
        <button type="button" disabled={busy} onClick={() => decide("QUALIFIED")} className="border border-emerald-700 px-3 py-2 text-xs font-semibold text-emerald-200 disabled:border-zinc-700 disabled:text-zinc-500">
          YES, WITH LIMITATIONS
        </button>
        <button type="button" disabled={busy} onClick={() => decide("FUTURE")} className="border border-zinc-600 px-3 py-2 text-xs font-semibold text-zinc-300 disabled:text-zinc-500">
          NOT YET
        </button>
        <button type="button" disabled={busy} onClick={() => decide("REJECTED")} className="border border-red-700 px-3 py-2 text-xs font-semibold text-red-200 disabled:border-zinc-700 disabled:text-zinc-500">
          DO NOT OFFER
        </button>
      </div>

      {previewingSource?.assetId ? (
        <EvidenceImageDialog
          organizationId={organizationId}
          siteId={siteId}
          assetId={previewingSource.assetId}
          fileName={previewingSource.originalFileName ?? previewingSource.label}
          onClose={() => setPreviewingSource(null)}
        />
      ) : null}
    </article>
  );
}

function EvidenceImageThumbnail({
  organizationId,
  siteId,
  assetId,
  fileName,
}: {
  organizationId: string;
  siteId: string;
  assetId: string;
  fileName: string;
}) {
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    fetch(`/api/sites/${encodeURIComponent(siteId)}/intelligence/assets/${encodeURIComponent(assetId)}`, {
      headers: {
        "x-gcp-roles": "ops_manager",
        "x-gcp-organization-id": organizationId,
        "x-gcp-site-id": siteId,
      },
      cache: "no-store",
    })
      .then((response) => {
        if (!response.ok) throw new Error("Preview unavailable");
        return response.blob();
      })
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
      })
      .catch(() => undefined);

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assetId, organizationId, siteId]);

  return source
    ? <Image src={source} alt={fileName} width={192} height={120} unoptimized className="h-24 w-40 rounded border border-zinc-700 object-cover" />
    : <div className="flex h-24 w-40 items-center justify-center rounded border border-zinc-700 bg-zinc-900 text-[11px] text-zinc-500">Loading evidence...</div>;
}

function EvidenceImageDialog({
  organizationId,
  siteId,
  assetId,
  fileName,
  onClose,
}: {
  organizationId: string;
  siteId: string;
  assetId: string;
  fileName: string;
  onClose(): void;
}) {
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    fetch(`/api/sites/${encodeURIComponent(siteId)}/intelligence/assets/${encodeURIComponent(assetId)}`, {
      headers: {
        "x-gcp-roles": "ops_manager",
        "x-gcp-organization-id": organizationId,
        "x-gcp-site-id": siteId,
      },
      cache: "no-store",
    })
      .then((response) => {
        if (!response.ok) throw new Error("Preview unavailable");
        return response.blob();
      })
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
      })
      .catch(() => undefined);

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assetId, organizationId, siteId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-auto border border-zinc-700 bg-zinc-950 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-white">Evidence preview</p>
          <button type="button" onClick={onClose} className="border border-zinc-700 px-3 py-1 text-xs font-semibold text-zinc-100">Close</button>
        </div>
        <p className="mt-2 text-xs text-zinc-400">{fileName}</p>
        <div className="mt-4">
          {source ? (
            <Image src={source} alt={fileName} width={1400} height={900} unoptimized className="h-auto max-h-[70vh] w-full object-contain" />
          ) : (
            <div className="flex h-72 items-center justify-center border border-zinc-700 bg-zinc-900 text-xs text-zinc-500">Loading evidence preview...</div>
          )}
        </div>
      </div>
    </div>
  );
}
