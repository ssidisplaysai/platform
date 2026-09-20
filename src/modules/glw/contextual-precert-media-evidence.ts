import type { SitePageMediaAssignment } from "@/modules/foundation/site-page-media-assignment";

type PreCaptureEvidenceInput = {
  assignments: readonly SitePageMediaAssignment[];
  targetId: string;
  pageRevisionIdentity: string;
  buildSessionId: string;
  featuredMediaId: string;
  wordpressObjectId: string;
  jobId: string;
  jobUpdatedAt: string;
};

function parseTime(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isLegacyJobScopedRevision(pageRevisionId: string, jobId: string): boolean {
  return pageRevisionId === `manual-remediation-v1:${jobId}`
    || pageRevisionId === `job:${jobId}`;
}

function withinCurrencyWindow(input: { assignment: SitePageMediaAssignment; jobUpdatedAt: string }): boolean {
  const jobTime = parseTime(input.jobUpdatedAt);
  if (jobTime === null) return false;
  const receiptTime = parseTime(input.assignment.wordpressReceipt?.verifiedAt ?? "");
  const approvalTime = parseTime(input.assignment.approval.approvedAt);
  if (receiptTime === null && approvalTime === null) return false;

  const deltaMs = 5 * 60 * 1000;
  if (receiptTime !== null && Math.abs(receiptTime - jobTime) <= deltaMs) return true;
  if (approvalTime !== null && Math.abs(approvalTime - jobTime) <= deltaMs) return true;
  return false;
}

export function resolvePreCaptureContextualAssignment(input: PreCaptureEvidenceInput): SitePageMediaAssignment | null {
  const featured = input.featuredMediaId.trim();
  if (!featured || !input.wordpressObjectId.trim()) return null;

  const scoped = input.assignments.filter((assignment) =>
    assignment.pageId === input.targetId
    && assignment.buildSessionId === input.buildSessionId
    && assignment.role === "CONTEXTUAL_IN_USE"
    && assignment.asset.type === "APPROVED_EXISTING"
    && Boolean(assignment.wordpressReceipt)
    && assignment.wordpressReceipt?.altTextVerified === true
    && assignment.wordpressReceipt?.placementVerified === true
    && String(assignment.wordpressReceipt?.mediaId ?? "") === featured
    && String(assignment.asset.wordpressMediaId ?? "") === featured
    && assignment.wordpressReceipt?.attachedToObjectId === input.wordpressObjectId
  );

  const exact = scoped.find((assignment) => assignment.pageRevisionId === input.pageRevisionIdentity) ?? null;
  if (exact) return exact;

  const compatible = scoped.find((assignment) =>
    isLegacyJobScopedRevision(assignment.pageRevisionId, input.jobId)
    && withinCurrencyWindow({ assignment, jobUpdatedAt: input.jobUpdatedAt })
  ) ?? null;

  return compatible;
}
