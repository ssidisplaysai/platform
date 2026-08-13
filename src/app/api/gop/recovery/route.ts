import { NextResponse } from "next/server";
import { handleAdjudicateManualReview, handleExecuteRecovery, handleGetRecoveryAudit } from "@/lib/gop/recovery-api";
import { createRecoveryTraceId, logRecoveryTrace } from "@/lib/gop/recovery-trace";

export async function GET(): Promise<NextResponse> {
  return handleGetRecoveryAudit();
}

export async function POST(request: Request): Promise<NextResponse> {
  const traceId = createRecoveryTraceId();
  const body = await request.json().catch(() => null) as {
    jobId?: string;
    decision?: string;
    reason?: string;
    idempotencyKey?: string;
    mode?: "RECOVER_SELECTED_SAFE" | "RECOVER_ALL_SAFE";
    selectedJobIds?: string[];
    dryRun?: boolean;
    approvalToken?: string;
  } | null;

  logRecoveryTrace(traceId, "ROUTE_ENTRY", body?.dryRun ?? null, {
    boundary: "ROUTE_ENTRY",
    authenticated: false,
    approvalTokenPresent: Boolean((body as { approvalToken?: string } | null)?.approvalToken),
    writeAuthorizationEntered: false,
    approvalGateEntered: false,
    persistenceBranchEntered: false,
  });

  const nextRequest = request.clone();
  const clonedBody = await nextRequest.json().catch(() => null) as { jobId?: string; decision?: string; reason?: string; idempotencyKey?: string; dryRun?: boolean; approvalToken?: string } | null;
  logRecoveryTrace(traceId, "ROUTE_CLONED_BODY", clonedBody?.dryRun ?? null, {
    boundary: "ROUTE_CLONED_BODY",
    authenticated: false,
    approvalTokenPresent: Boolean(clonedBody?.approvalToken),
    writeAuthorizationEntered: false,
    approvalGateEntered: false,
    persistenceBranchEntered: false,
  });

  if (body && typeof body.jobId === "string" && typeof body.decision === "string" && body.decision === "MARK_FAILED") {
    return handleAdjudicateManualReview(request);
  }

  const requestWithTrace = new Request(request, {
    headers: {
      ...(request.headers as Headers),
      "x-glw-recovery-trace-id": traceId,
    },
  });

  return handleExecuteRecovery(requestWithTrace);
}
