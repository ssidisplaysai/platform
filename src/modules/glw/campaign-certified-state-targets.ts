import "server-only";

import { createHash } from "node:crypto";
import type { GlwCampaign } from "./campaign-types";
import { createGlwCampaignStateTargetId } from "./campaign-target-repository";
import { listExactPublicationRollbackReceipts } from "./exact-publication-rollback-authority";
import { listRichReferenceHostRepairReceipts } from "./rich-reference-host-repair-repository";

export type GlwCertifiedStateTarget = {
  stateCode: string;
  targetId: string;
  wordpressObjectId: string;
  certificationId: string;
  evidenceId: string;
  evidenceFingerprint: string;
  certifiedAt: string;
};

function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function listGlwCertifiedStateCampaignTargets(campaign: GlwCampaign): readonly GlwCertifiedStateTarget[] {
  if (campaign.pageType !== "state_service") return [];
  const publicationReceipts = listExactPublicationRollbackReceipts().filter((receipt) =>
    receipt.organizationId === campaign.organizationId
    && receipt.siteId === campaign.siteId
    && receipt.campaignId === campaign.campaignId
    && receipt.productId === campaign.productId);
  const certified = new Map<string, GlwCertifiedStateTarget>();
  const add = (input: Omit<GlwCertifiedStateTarget, "evidenceFingerprint">) => {
    const stateCode = input.stateCode.trim().toUpperCase();
    if (!campaign.stateCodes.includes(stateCode) || input.targetId !== createGlwCampaignStateTargetId(campaign.campaignId, stateCode)) return;
    const value = { ...input, stateCode, evidenceFingerprint: fingerprint(input) };
    const current = certified.get(stateCode);
    if (!current || current.certifiedAt < value.certifiedAt) certified.set(stateCode, value);
  };

  for (const receipt of publicationReceipts) {
    if (receipt.lifecycleState !== "PUBLIC_CERTIFIED" || !receipt.publicCertificationId) continue;
    add({ stateCode: receipt.stateCode, targetId: receipt.targetId, wordpressObjectId: receipt.wordpressObjectId, certificationId: receipt.publicCertificationId, evidenceId: receipt.receiptId, certifiedAt: receipt.recordedAt });
  }
  for (const repair of listRichReferenceHostRepairReceipts()) {
    if (repair.organizationId !== campaign.organizationId || repair.siteId !== campaign.siteId || repair.campaignId !== campaign.campaignId || repair.lifecycleState !== "PUBLIC_CERTIFIED" || !repair.publicCertificationId || !repair.completedAt) continue;
    const source = publicationReceipts.find((receipt) => receipt.receiptId === repair.sourcePublicationReceiptId);
    if (!source || source.targetId !== repair.targetId || source.wordpressObjectId !== repair.wordpressObjectId) continue;
    add({ stateCode: source.stateCode, targetId: repair.targetId, wordpressObjectId: repair.wordpressObjectId, certificationId: repair.publicCertificationId, evidenceId: repair.repairReceiptId, certifiedAt: repair.completedAt });
  }
  return [...certified.values()].sort((left, right) => left.stateCode.localeCompare(right.stateCode));
}

export function resolveGlwCertifiedStateActivationReference(campaign: GlwCampaign, stateCode: string): GlwCertifiedStateTarget | null {
  const normalized = stateCode.trim().toUpperCase();
  return listGlwCertifiedStateCampaignTargets(campaign).find((target) => target.stateCode === normalized) ?? null;
}