import "server-only";

import type {
  GlwCampaignTarget,
} from "@/modules/glw/campaign-target-repository";

export type GlwCampaignTargetRecoveryAction =
  | "resume_exact_target"
  | "recover_exact_job"
  | "none";

export function resolveGlwCampaignTargetRecoveryAction(
  target: GlwCampaignTarget,
): GlwCampaignTargetRecoveryAction {
  if (target.status !== "running") {
    return "none";
  }

  if (target.jobId) {
    return "recover_exact_job";
  }

  if (
    target.dispatchDate
    && target.leaseId
  ) {
    return "resume_exact_target";
  }

  return "none";
}

export type GlwCampaignJobReconciliationDecision =
  | {
      action: "wait";
    }
  | {
      action: "continue";
    }
  | {
      action: "draft_ready";
      wordpressObjectId: string;
    }
  | {
      action: "failed";
      error: string;
    };

function isRecoverableContentFailure(job: {
  status: string;
  errorCode?: string | null;
  generatedDraft?: unknown;
}): boolean {
  return job.status === "FAILED"
    && Boolean(job.generatedDraft)
    && (
      job.errorCode === "GENERATED_CONTENT_QA_FAILED"
      || job.errorCode?.startsWith("CONTENT_REPAIR_") === true
    );
}

function isRecoverableWordPressFailure(job: {
  status: string;
  errorCode?: string | null;
  generatedDraft?: unknown;
}): boolean {
  if (
    job.status !== "FAILED"
    || !job.generatedDraft
    || !job.errorCode
  ) {
    return false;
  }

  return new Set([
    "WORDPRESS_HIERARCHY_READ_FAILED",
    "WORDPRESS_HIERARCHY_WRITE_FAILED",
    "WORDPRESS_READ_FAILED",
    "WORDPRESS_WRITE_FAILED",
  ]).has(job.errorCode);
}

export function resolveGlwCampaignJobReconciliationDecision(
  job: {
    status: string;
    wordpressObjectId?: string | number | null;
    wordpressStatus?: string | null;
    error?: string | null;
    errorCode?: string | null;
    generatedDraft?: unknown;
  },
): GlwCampaignJobReconciliationDecision {
  if (
    job.status === "CONTENT_READY"
    || isRecoverableContentFailure(job)
    || isRecoverableWordPressFailure(job)
  ) {
    return {
      action: "continue",
    };
  }

  if (job.status === "COMPLETE") {
    const wordpressObjectId =
      job.wordpressObjectId === null
      || job.wordpressObjectId === undefined
        ? ""
        : String(job.wordpressObjectId).trim();

    if (
      wordpressObjectId
      && job.wordpressStatus === "draft"
    ) {
      return {
        action: "draft_ready",
        wordpressObjectId,
      };
    }

    return {
      action: "failed",
      error:
        "Completed generation did not resolve to a verified WordPress draft.",
    };
  }

  if (job.status === "FAILED") {
    return {
      action: "failed",
      error:
        job.error?.trim()
        || "Generation failed.",
    };
  }

  return {
    action: "wait",
  };
}
