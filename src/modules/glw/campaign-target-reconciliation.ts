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

export function resolveGlwCampaignJobReconciliationDecision(
  job: {
    status: string;
    wordpressObjectId?: string | number | null;
    wordpressStatus?: string | null;
    error?: string | null;
  },
): GlwCampaignJobReconciliationDecision {
  if (job.status === "CONTENT_READY") {
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