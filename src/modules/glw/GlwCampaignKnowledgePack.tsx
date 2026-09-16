"use client";

import { useEffect, useRef, useState } from "react";
import { operatorMutationHeaders } from "@/modules/foundation/operator-session-client";
import type { GlwCampaign } from "./campaign-types";
import { GLW_CAMPAIGN_US_STATES } from "./campaign-geography";
import type { GlwCampaignKnowledgePack } from "./campaign-reference-types";
import { OutdoorSphereMediaAuthorityPanel } from "./OutdoorSphereMediaAuthorityPanel";
import { projectGlwClaimDisposition } from "./reference-claim-disposition";
import { GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_VERSION } from "./reference-generation-claim-contract-version";

type ReferenceJob = Record<string, unknown> & {
  jobId?: string;
  externalExecutionId?: string | null;
  status?: string;
  qaStatus?: string | null;
  wordCount?: number | null;
  wordpressObjectId?: string | null;
  wordpressStatus?: string | null;
  wordpressUrl?: string | null;
  featuredImagePresent?: boolean | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  qaChecks?: {
    claimAuthority?: {
      policyVersion?: string;
      findings?: Array<{
        claimClass: string;
        claimText: string;
        authoritySource: string | null;
        authorityStatus: string;
        predicateId: string;
      }>;
    };
  } | null;
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
  wordpressAuthority?: WordPressAuthorityStatus;
  workflow?: ReferenceWorkflowProjection;
  relatedReference?: {
    stateCode: string | null;
    attribution: "UNIQUE_CAMPAIGN_SITE_PRODUCT_RECOVERY";
    job: ReferenceJob;
    workflow: ReferenceWorkflowProjection;
  } | null;
  selectedReferenceState?: { stateCode: string; selectedAt: string } | null;
  generationAuthority?: ReferenceAuthorityBinding | null;
  retryContract?: { referenceState: "IN"; ownerAuthorizationRequired: true; executable: false } | null;
  durableOperation?: { operationType: "REFERENCE_GENERATION_INITIAL" | "REFERENCE_GENERATION_RETRY"; failedJobId: string | null; failedArtifactSha256: string | null };
  mcpConfiguration?: { configured: boolean; transport: string; workflowId: string; engineWorkflowId: string };
  failedDispatchRecovery?: boolean;
  ownerReviewReadiness?: {
    ready: boolean;
    pageClassification: "LONG_FORM_ARTICLE" | "RICH_REFERENCE_COMPOSITION";
    blockers: readonly string[];
    semantic: { unsupportedFactualClaims: number; buyerQuestionPremiseEscapes: number; comparisonFactEscapes: number };
    copyQuality: { failures: readonly { code: string; text: string }[] };
  } | null;
  richCompositionReadiness?: {
    ready: boolean;
    state: "READY_FOR_OWNER_REVIEW" | "REFERENCE_COMPOSITION_BLOCKED";
    blockers: readonly string[];
    articleHtmlFinalPresentationAuthority: false;
  } | null;
};

type ReferenceAuthorityBinding = {
  campaignInstructionFingerprint: string;
  referenceFingerprint: string;
  productAuthorityFingerprint: string;
  claimAuthorityFingerprint: string;
  generatorContractFingerprint: string;
  localizationPolicyFingerprint: string;
  n8nWorkflowFingerprint: string;
  qaPolicyVersion: string;
};

type ReferenceWorkflowProjection = {
  state:
    | "READY_TO_GENERATE_REFERENCE"
    | "REFERENCE_GENERATION_IN_PROGRESS"
    | "REFERENCE_DRAFT_READY"
    | "REFERENCE_RECOVERY_REQUIRED"
    | "REFERENCE_GENERATION_FAILED"
    | "REFERENCE_BLOCKED"
    | "REFERENCE_RETRY_READY";
  operationId: string | null;
  targetStateCode: string | null;
  targetStateName: string | null;
  lastUpdatedAt: string | null;
  durable: boolean;
  safeOwnerAction: string;
  errorCode: string | null;
  errorMessage: string | null;
  artifactSha256: string | null;
  qaFailures: ReadonlyArray<{
    predicateId: string;
    predicateName: string;
    expected: string;
    observed: string;
    evidence: string;
    severity: "BLOCKING";
  }>;
  proposedRecoveryAction: string | null;
  nextReferenceStateCode?: string | null;
  retryRequiresNewOwnerAuthorization?: boolean;
  retryExecutable?: boolean;
};

type WordPressAuthorityStatus = {
  siteId: string;
  domain: string | null;
  wordpressBaseUrl: string | null;
  configuredUsername: string | null;
  authorityHealthState: "READY" | "CONNECTION_REQUIRED" | "REPAIR_REQUIRED" | "BLOCKED";
  reason: string;
  recoveryAction: "CONNECT_WORDPRESS" | "REPAIR_WORDPRESS_AUTHORITY" | null;
  recoveryHref: string | null;
  lastCheckedAt: string;
};

type OwnerAuthorityCapability = {
  available: boolean;
  principalAuthority: string;
  principalSessionBound: boolean;
  prerequisite: string | null;
  grant?: {
    grantId: string;
    preflightReceiptId: string;
    issuedAt: string;
    expiresAt: string;
    status: "ACTIVE" | "CONSUMED" | "REVOKED" | "EXPIRED";
    valid: boolean;
  } | null;
};

export function GlwCampaignKnowledgePack({ campaign, organizationId, initialReferenceState }: { campaign: GlwCampaign; organizationId: string; initialReferenceState?: string | null }) {
  const [pack, setPack] = useState<GlwCampaignKnowledgePack | null>(null);
  const [instructions, setInstructions] = useState("");
  const [provenance, setProvenance] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [role, setRole] = useState("content_reference");
  const [scope, setScope] = useState("campaign");
  const [message, setMessage] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [referenceState, setReferenceState] = useState(initialReferenceState ?? campaign.stateCodes[0] ?? "");
  const [generatingReference, setGeneratingReference] = useState(false);
  const [recoveringReference, setRecoveringReference] = useState(false);
  const [continuingReference, setContinuingReference] = useState(false);
  const [approvingReference, setApprovingReference] = useState(false);
  const [activatingCampaign, setActivatingCampaign] = useState(false);
  const [continuationAttemptedJobId, setContinuationAttemptedJobId] = useState<string | null>(null);
  const [referenceResult, setReferenceResult] = useState<ReferenceResult | null>(null);
  const [wordpressAuthority, setWordpressAuthority] = useState<WordPressAuthorityStatus | null>(null);
  const [ownerAuthority, setOwnerAuthority] = useState<OwnerAuthorityCapability | null>(null);
  const [ownerPreflightReceiptId, setOwnerPreflightReceiptId] = useState<string | null>(null);
  const [ownerGrantId, setOwnerGrantId] = useState<string | null>(null);
  const [ownerAuthorityBusy, setOwnerAuthorityBusy] = useState(false);
  const projectedReferenceState = useRef<string | null>(null);

  const headers = {
    "x-gcp-roles": "platform_admin",
    "x-gcp-organization-id": organizationId,
    "x-gcp-site-id": campaign.siteId,
  };

  const endpoint = `/api/glw/campaigns/${encodeURIComponent(campaign.campaignId)}/references`;
  const generateEndpoint = `/api/glw/campaigns/${encodeURIComponent(campaign.campaignId)}/generate-instructions`;
  const referenceEndpoint = `/api/glw/campaigns/${encodeURIComponent(campaign.campaignId)}/reference-page`;
  const ownerAuthorityEndpoint = `/api/glw/campaigns/${encodeURIComponent(campaign.campaignId)}/reference-authority`;

  async function load() {
    const [response, authorityResponse] = await Promise.all([
      fetch(endpoint, { headers }),
      fetch(ownerAuthorityEndpoint, { headers, cache: "no-store" }),
    ]);
    const authorityPayload = await authorityResponse.json().catch(() => null) as OwnerAuthorityCapability | null;
    setOwnerAuthority(authorityPayload);
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
      setWordpressAuthority(payload.wordpressAuthority ?? null);
      if (payload.selectedReferenceState?.stateCode && payload.selectedReferenceState.stateCode !== referenceState) {
        projectedReferenceState.current = payload.selectedReferenceState.stateCode;
        setReferenceState(payload.selectedReferenceState.stateCode);
      }

      if (!response.ok) {
        setMessage(payload.error ?? "Unable to recover the reference-page job.");
        return;
      }

      const projectedWorkflow = payload.relatedReference?.workflow ?? payload.workflow;
      if (projectedWorkflow) {
        const authorityParams = new URLSearchParams({
          operationType: projectedWorkflow.state === "REFERENCE_RETRY_READY" ? "REFERENCE_GENERATION_RETRY" : "REFERENCE_GENERATION_INITIAL",
          organizationId,
          siteId: campaign.siteId,
          referenceState: payload.selectedReferenceState?.stateCode ?? referenceState,
        });
        if (projectedWorkflow.state === "REFERENCE_RETRY_READY" && projectedWorkflow.operationId && projectedWorkflow.artifactSha256) {
          authorityParams.set("failedJobId", projectedWorkflow.operationId);
          authorityParams.set("failedArtifactSha256", projectedWorkflow.artifactSha256);
        }
        const authorityResponse = await fetch(`${ownerAuthorityEndpoint}?${authorityParams.toString()}`, { headers, cache: "no-store" });
        const authorityPayload = await authorityResponse.json().catch(() => null) as OwnerAuthorityCapability | null;
        if (authorityPayload) {
          setOwnerAuthority(authorityPayload);
          if (authorityPayload.grant?.valid) {
            setOwnerGrantId(authorityPayload.grant.grantId);
            setOwnerPreflightReceiptId(authorityPayload.grant.preflightReceiptId);
          } else {
            setOwnerGrantId(null);
            setOwnerPreflightReceiptId(null);
          }
        }
      }

      if (payload.relatedReference?.job && payload.relatedReference.stateCode) {
        setReferenceResult({
          ...payload,
          job: payload.relatedReference.job,
          workflow: payload.relatedReference.workflow,
        });
        return;
      }
      setReferenceResult(payload);
    } finally {
      setRecoveringReference(false);
    }
  }

  useEffect(() => {
    if (projectedReferenceState.current === referenceState) {
      projectedReferenceState.current = null;
      return;
    }
    void load();
    void recoverReferencePage(false);
  }, [campaign.campaignId, referenceState]);

  async function approveInstructions() {
    setMessage(null);

    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: operatorMutationHeaders({ ...headers, "Content-Type": "application/json" }),
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
      headers: operatorMutationHeaders(headers),
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
      headers: operatorMutationHeaders(headers),
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
    setContinuationAttemptedJobId(null);

    try {
      const response = await fetch(referenceEndpoint, {
        method: "POST",
        headers: operatorMutationHeaders({
          ...headers,
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          stateCode: referenceState,
          referenceAuthorityBinding: referenceResult?.generationAuthority,
          ownerGrantId,
          preflightReceiptId: ownerPreflightReceiptId,
          ownerOperationType: retryOperation ? "REFERENCE_GENERATION_RETRY" : "REFERENCE_GENERATION_INITIAL",
          failedJobId: retryOperation ? referenceWorkflow?.operationId : null,
          failedArtifactSha256: retryOperation ? referenceWorkflow?.artifactSha256 : null,
        }),
      });

      const payload = await response.json() as ReferenceResult;
      setReferenceResult((current) => ({
        ...current,
        ...payload,
        job: payload.job ?? current?.job ?? null,
        workflow: payload.workflow ?? current?.workflow,
        retryContract: payload.retryContract ?? current?.retryContract,
      }));

      if (!response.ok) {
        setOwnerGrantId(null);
        setOwnerPreflightReceiptId(null);
        setMessage(payload.error ?? "Reference page generation did not complete.");
      } else {
        setMessage("Reference generation started. Genesis will recover the same job automatically until the draft is ready.");
      }
    } finally {
      setGeneratingReference(false);
    }
  }

  async function runOwnerPreflight() {
    setOwnerAuthorityBusy(true);
    setMessage(null);
    try {
      const response = await fetch(ownerAuthorityEndpoint, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RUN_PREFLIGHT",
          operationType: retryOperation ? "REFERENCE_GENERATION_RETRY" : "REFERENCE_GENERATION_INITIAL",
          organizationId,
          siteId: campaign.siteId,
          referenceState,
          failedJobId: retryOperation ? referenceWorkflow?.operationId : null,
          failedArtifactSha256: retryOperation ? referenceWorkflow?.artifactSha256 : null,
        }),
      });
      const payload = await response.json() as { receipt?: { receiptId: string }; error?: string };
      if (!response.ok || !payload.receipt) {
        setMessage(payload.error ?? "Reference preflight failed closed.");
        return;
      }
      setOwnerPreflightReceiptId(payload.receipt.receiptId);
      setOwnerGrantId(null);
      setMessage("Exact reference-generation preflight is ready for owner authorization.");
    } finally {
      setOwnerAuthorityBusy(false);
    }
  }

  async function authorizeOwnerAction() {
    if (!ownerPreflightReceiptId) return;
    setOwnerAuthorityBusy(true);
    setMessage(null);
    try {
      const response = await fetch(ownerAuthorityEndpoint, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "AUTHORIZE",
          operationType: retryOperation ? "REFERENCE_GENERATION_RETRY" : "REFERENCE_GENERATION_INITIAL",
          organizationId,
          siteId: campaign.siteId,
          referenceState,
          failedJobId: retryOperation ? referenceWorkflow?.operationId : null,
          failedArtifactSha256: retryOperation ? referenceWorkflow?.artifactSha256 : null,
          preflightReceiptId: ownerPreflightReceiptId,
        }),
      });
      const payload = await response.json() as { grant?: NonNullable<OwnerAuthorityCapability["grant"]>; error?: string };
      if (!response.ok || !payload.grant) {
        setMessage(payload.error ?? "Reference owner authorization failed closed.");
        return;
      }
      setOwnerGrantId(payload.grant.grantId);
      setOwnerAuthority((current) => current ? { ...current, grant: { ...payload.grant!, valid: true } } : current);
      setMessage("One expiring reference-generation owner grant is ready. No generation has occurred.");
    } finally {
      setOwnerAuthorityBusy(false);
    }
  }

  async function persistReferenceState(stateCode: string) {
    setMessage(null);
    const response = await fetch(referenceEndpoint, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ stateCode }),
    });
    const payload = await response.json() as ReferenceResult;
    if (!response.ok) {
      setMessage(payload.error ?? "Unable to persist the reference state.");
      return;
    }
    setReferenceState(stateCode);
    setReferenceResult(null);
    setContinuationAttemptedJobId(null);
  }

  async function approveReferencePage(jobId: string) {
    setApprovingReference(true);
    setMessage(null);

    try {
      const response = await fetch(referenceEndpoint, {
        method: "PATCH",
        headers: operatorMutationHeaders({
          ...headers,
          "Content-Type": "application/json",
        }),
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
          headers: operatorMutationHeaders(headers),
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
        headers: operatorMutationHeaders({
          ...headers,
          "Content-Type": "application/json",
        }),
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
    label: GLW_CAMPAIGN_US_STATES.find((state) => state.code === code)?.name ?? code,
  }));
  const selectedStateLabel = stateOptions.find((state) => state.code === referenceState)?.label ?? referenceState;

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
  const unsupportedClaimFindings = job?.qaChecks?.claimAuthority?.findings?.filter((finding) => finding.authorityStatus === "UNSUPPORTED") ?? [];
  const ownerReviewReadiness = referenceResult?.ownerReviewReadiness ?? null;
  const richCompositionReadiness = referenceResult?.richCompositionReadiness ?? null;

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
  const wordpressAuthorityState = wordpressAuthority?.authorityHealthState ?? "CHECKING";
  const wordpressAuthorityReady = wordpressAuthorityState === "READY";
  const wordpressAuthorityLabel = wordpressAuthorityState === "READY"
    ? "READY"
    : wordpressAuthorityState === "CONNECTION_REQUIRED"
      ? "CONNECTION REQUIRED"
      : wordpressAuthorityState === "REPAIR_REQUIRED"
        ? "REPAIR REQUIRED"
        : wordpressAuthorityState;
  const referenceWorkflow = referenceResult?.workflow ?? null;
        const retryOperation = referenceResult?.durableOperation?.operationType === "REFERENCE_GENERATION_RETRY"
          || referenceWorkflow?.state === "REFERENCE_RETRY_READY"
          || Boolean(referenceResult?.retryContract);
        const sameJobRecoveryRequired = Boolean(referenceResult?.failedDispatchRecovery && jobId);
        const terminalQaBlocked = jobStatus === "FAILED"
          && job?.errorCode === "GENERATED_CONTENT_QA_FAILED"
          && Boolean(job?.generatedDraft);
  const ownerGrantReady = Boolean(ownerGrantId && ownerAuthority?.grant?.valid);
  const existingOperationBlocksGeneration = Boolean(
    referenceWorkflow &&
      referenceWorkflow.state !== "READY_TO_GENERATE_REFERENCE"
      && !(retryOperation && ownerGrantReady),
  );
  const referenceActionLabel = generatingReference
    ? "Starting Reference Generation..."
    : recoveringReference
      ? "Checking Existing Reference..."
      : continuingReference
        ? "Continuing Existing Reference..."
        : referenceWorkflow?.state === "REFERENCE_GENERATION_IN_PROGRESS"
          ? "Reference Generation In Progress"
          : referenceWorkflow?.state === "REFERENCE_DRAFT_READY"
            ? "Reference Draft Ready"
            : referenceWorkflow?.state === "REFERENCE_RECOVERY_REQUIRED"
              ? "Reference Recovery Required"
              : retryOperation
                ? ownerGrantReady
                  ? "Generate / Execute One Indiana Remediated Retry"
                  : "Indiana Retry Requires New Authorization"
              : referenceWorkflow?.state === "REFERENCE_GENERATION_FAILED"
                ? "Reference Generation Failed"
                : referenceWorkflow?.state === "REFERENCE_BLOCKED"
                  ? "Reference Blocked"
                : `Generate ${selectedStateLabel} Reference Page`;

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

      {campaign.productId === "prod-outdoor-digital-sphere" ? (
        <OutdoorSphereMediaAuthorityPanel organizationId={organizationId} siteId={campaign.siteId} productId={campaign.productId} />
      ) : null}

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

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border border-zinc-800 bg-zinc-950 px-3 py-3 text-xs">
          <div>
            <p className="font-semibold text-white">WordPress Authority: {wordpressAuthorityLabel}</p>
            <p className="mt-1 text-zinc-400">
              {wordpressAuthority?.reason ?? `Checking authenticated read authority for ${campaign.siteId}.`}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs text-zinc-300">
            Reference State
            <select
              value={referenceState}
              onChange={(e) => {
                void persistReferenceState(e.target.value);
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

          <div className="text-xs text-zinc-300">
            <p>Reference State: <strong className="text-white">{selectedStateLabel} ({referenceState})</strong></p>
            <p className="mt-1 text-zinc-500">The exact selection is persisted before authorization.</p>
          </div>

          <button
            type="button"
            disabled={!instructionsApproved || generationBusy || existingOperationBlocksGeneration || !wordpressAuthorityReady || !campaign.stateCodes.includes(referenceState)}
            onClick={generateReferencePage}
            className="h-10 rounded-lg bg-red-600 px-4 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {referenceActionLabel}
          </button>
        </div>

        <div className="mt-3 border border-zinc-800 bg-zinc-950 px-3 py-3 text-xs">
          <p className="font-semibold text-white">Owner Action Authority</p>
          <p className="mt-1 text-zinc-300">Campaign: {campaign.name}</p>
          <p className="text-zinc-300">State: {selectedStateLabel} ({referenceState})</p>
          <p className="text-zinc-300">Operation: {retryOperation ? "Reference Generation Retry" : "Initial Reference Generation"}</p>
          {retryOperation && referenceWorkflow?.operationId ? <p className="text-zinc-300">Failed job: {referenceWorkflow.operationId}</p> : null}
          <p className="text-zinc-300">Authorization: {ownerGrantReady ? "AUTHORIZED" : terminalQaBlocked ? "BLOCKED_BY_QA" : sameJobRecoveryRequired ? "CONSUMED_FOR_EXISTING_JOB" : "REQUIRES_OWNER_AUTHORIZATION"}</p>
          {sameJobRecoveryRequired ? <p className="text-zinc-300">Existing recovery job: {jobId}</p> : null}
          {job?.externalExecutionId ? <p className="text-zinc-300">n8n execution: {job.externalExecutionId}</p> : null}
          <p className="text-zinc-300">MCP: {referenceResult?.mcpConfiguration?.configured ? "CONFIGURED" : "NOT_CONFIGURED"}</p>
          <p className="text-zinc-300">Generator contract: {GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_VERSION}</p>
          <p className="text-zinc-300">QA policy: {job?.qaChecks?.claimAuthority?.policyVersion ?? referenceResult?.generationAuthority?.qaPolicyVersion ?? "CHECKING"}</p>
          <p className="mt-1 text-zinc-500">Principal authority: {ownerAuthority?.principalAuthority ?? "CHECKING"}</p>
          {ownerAuthority?.prerequisite ? <p className="mt-1 text-amber-300">Unavailable: {ownerAuthority.prerequisite}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {!ownerGrantReady && !sameJobRecoveryRequired ? (
              <>
                <button type="button" disabled={!ownerAuthority?.available || ownerAuthorityBusy} onClick={() => void runOwnerPreflight()} className="border border-zinc-700 px-3 py-2 font-semibold text-white disabled:opacity-40">
                  {terminalQaBlocked ? "Run Remediated Retry Preflight" : retryOperation ? "Run Retry Preflight" : "Run Preflight"}
                </button>
                <button type="button" disabled={!ownerAuthority?.available || !ownerPreflightReceiptId || ownerAuthorityBusy} onClick={() => void authorizeOwnerAction()} className="border border-red-600 px-3 py-2 font-semibold text-red-200 disabled:opacity-40">
                  {retryOperation ? "Authorize One Retry" : "Authorize Reference Generation"}
                </button>
              </>
            ) : null}
          </div>
        </div>

        {referenceWorkflow ? (
          <div className="mt-3 border border-zinc-800 bg-zinc-950 px-3 py-3 text-xs">
            <p className="font-semibold text-white">Reference Workflow: {referenceWorkflow.state.replaceAll("_", " ")}</p>
            {referenceWorkflow.state === "REFERENCE_RETRY_READY" ? (
              <p className="mt-1 font-semibold text-amber-300">Next Reference State: Indiana (IN)</p>
            ) : null}
            <p className="mt-1 text-zinc-400">
              Target: {referenceWorkflow.targetStateCode ?? referenceState}
              {referenceWorkflow.operationId ? ` · Operation: ${referenceWorkflow.operationId}` : ""}
            </p>
            {referenceWorkflow.lastUpdatedAt ? (
              <p className="mt-1 text-zinc-500">Last update: {new Date(referenceWorkflow.lastUpdatedAt).toLocaleString()}</p>
            ) : null}
            <p className="mt-1 text-zinc-400">Safe owner action: {referenceWorkflow.safeOwnerAction.replaceAll("_", " ")}</p>
            {referenceWorkflow.artifactSha256 ? (
              <p className="mt-1 break-all font-mono text-zinc-500">Artifact: {referenceWorkflow.artifactSha256}</p>
            ) : null}
            {referenceWorkflow.qaFailures.map((failure) => (
              <div key={failure.predicateId} className="mt-2 border-l-2 border-red-600 pl-3 text-zinc-300">
                <p className="font-semibold text-red-300">{failure.predicateName}</p>
                <p>Expected: {failure.expected}</p>
                <p>Observed: {failure.observed}</p>
                <p>Evidence: {failure.evidence}</p>
              </div>
            ))}
            {referenceWorkflow.proposedRecoveryAction ? (
              <p className="mt-2 font-semibold text-amber-300">Proposed recovery: {referenceWorkflow.proposedRecoveryAction.replaceAll("_", " ")}</p>
            ) : null}
            {referenceWorkflow.state === "REFERENCE_RETRY_READY" ? (
              <p className="mt-2 text-zinc-300">
                {ownerGrantReady
                  ? "One unconsumed single-use owner authorization is active. Generation remains an explicit owner action."
                  : "A new single-use owner authorization is required. Retry remains disabled."}
              </p>
            ) : null}
          </div>
        ) : null}

        {!instructionsApproved ? (
          <p className="mt-2 text-xs text-zinc-500">
            Approve the current instructions to unlock reference generation.
          </p>
        ) : null}
        {instructionsApproved && !wordpressAuthorityReady ? (
          <p className="mt-2 text-xs text-amber-300">
            Reference generation remains disabled until this site&apos;s WordPress read authority is ready.
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

            {referenceWorkflow?.state === "REFERENCE_RETRY_READY" ? (
              <div className="mt-4 border border-red-900/60 bg-red-950/20 p-3 text-zinc-300">
                <p className="font-semibold text-red-300">Prior Reference Failure</p>
                <p className="mt-1">Failed State: Illinois (IL)</p>
                <p>Failed Job ID: {jobId}</p>
                <p className="break-all font-mono">Failed Artifact SHA-256: {referenceWorkflow.artifactSha256}</p>
                <p>QA failure: required Outdoor Digital Sphere product-authority link was missing; hardened claim QA also blocks unsupported factual claims.</p>
                <p>No WordPress page was created.</p>
                <p className="mt-1 font-semibold text-amber-300">Safe status: preserved evidence; do not retry without new exact authorization.</p>
              </div>
            ) : null}

            {unsupportedClaimFindings.length > 0 ? (
              <div className="mt-4 border border-red-900/60 bg-red-950/20 p-3 text-zinc-300">
                <p className="font-semibold text-red-300">Unsupported Claim Evidence ({unsupportedClaimFindings.length})</p>
                <p className="mt-1 text-zinc-400">Policy: {job?.qaChecks?.claimAuthority?.policyVersion ?? "UNKNOWN"}</p>
                <div className="mt-3 space-y-3">
                  {unsupportedClaimFindings.map((finding, index) => (
                    <div key={`${finding.predicateId}-${index}`} className="border-l-2 border-red-700 pl-3">
                      {(() => {
                        const disposition = projectGlwClaimDisposition(finding);
                        return <>
                      <p className="font-semibold text-white">Claim {String(index + 1).padStart(2, "0")} · {finding.claimClass}</p>
                      <p className="mt-1">{finding.claimText}</p>
                      <p className="mt-1 text-zinc-400">Failed predicate: {finding.predicateId}</p>
                      <p className="text-zinc-400">Current predicate: {disposition.currentPredicateResult} · {disposition.blocking ? "BLOCKING" : "NON_BLOCKING"}</p>
                      <p className="text-zinc-400">Reason: {disposition.reason}</p>
                      <p className="text-zinc-400">Required authority: {disposition.requiredAuthority}</p>
                      <p className="font-semibold text-amber-300">Disposition: {disposition.disposition}</p>
                        </>;
                      })()}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {job.status === "COMPLETE" ? (
              <div className={`mt-4 rounded-lg border p-3 ${ownerReviewReadiness?.ready ? "border-emerald-900/60 bg-emerald-950/20" : "border-amber-900/60 bg-amber-950/20"}`}>
                <p className={`font-semibold ${ownerReviewReadiness?.ready ? "text-emerald-300" : "text-amber-300"}`}>
                  {referenceResult.approved ? "Reference Approved" : ownerReviewReadiness?.ready && richCompositionReadiness?.ready ? "Reference Ready" : "Owner Review Remediation Required"}
                </p>

                <p className="mt-1 text-zinc-400">
                  {referenceResult.approved
                    ? "This exact completed job and WordPress draft are locked as the approved campaign reference."
                    : ownerReviewReadiness?.ready && richCompositionReadiness?.ready
                      ? "Genesis completed the persisted job. Review it, then approve this exact draft before campaign activation."
                      : `${ownerReviewReadiness?.pageClassification.replaceAll("_", " ") ?? "Reference composition"} is not approval-ready. Blockers: ${[...(ownerReviewReadiness?.blockers ?? []), ...(richCompositionReadiness?.blockers ?? [])].filter((value, index, values) => values.indexOf(value) === index).join(", ") || "owner review required"}.`}
                </p>

                {!referenceResult.approved && ownerReviewReadiness?.ready && richCompositionReadiness?.ready && jobId ? (
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