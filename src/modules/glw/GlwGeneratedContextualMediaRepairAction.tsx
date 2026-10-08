"use client";

import React, { useState } from "react";
import { operatorMutationHeaders } from "@/modules/foundation/operator-session-client";

type GeneratedContextualRepairIdentity = {
  campaignId: string;
  targetId: string;
  jobId: string;
  externalExecutionId: string;
  wordpressObjectId: string;
  productId: string;
  pageRevisionId: string;
  expectedStoredSha256: string;
};

export function GlwGeneratedContextualMediaRepairAction(props: {
  endpoint: string;
  organizationId: string;
  siteId: string;
  operation: "REPAIR_DRAFT_READY_GENERATED_CONTEXTUAL_MEDIA";
  label: "Generate Contextual Image" | "Replace Legacy Contextual Image" | "Reconcile Featured Contextual Image" | "Build Contextual Visual Set";
  identity: GeneratedContextualRepairIdentity;
}) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch(props.endpoint, {
        method: "POST",
        headers: operatorMutationHeaders({
          "content-type": "application/json",
          "x-gcp-roles": "platform_admin",
          "x-gcp-organization-id": props.organizationId,
          "x-gcp-site-id": props.siteId,
        }),
        body: JSON.stringify({
          operation: props.operation,
          expectedCampaignId: props.identity.campaignId,
          expectedTargetId: props.identity.targetId,
          expectedJobId: props.identity.jobId,
          expectedExternalExecutionId: props.identity.externalExecutionId,
          expectedWordpressObjectId: props.identity.wordpressObjectId,
          expectedProductId: props.identity.productId,
          expectedPageRevisionId: props.identity.pageRevisionId,
          expectedStoredSha256: props.identity.expectedStoredSha256,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Generated contextual media repair failed");
      }
      window.location.reload();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Generated contextual media repair failed",
      );
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="mt-4 border-t border-zinc-800 pt-4">
      <button
        type="button"
        disabled={running}
        onClick={run}
        className="bg-sky-700 px-4 py-2 text-sm font-bold text-white hover:bg-sky-600 disabled:opacity-50"
      >
        {running ? "Generating contextual media..." : props.label}
      </button>
      <p className="mt-2 text-xs text-zinc-500">
        Draft-only contextual image repair. This does not publish, approve,
        dispatch, or regenerate page content.
      </p>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
