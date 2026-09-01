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