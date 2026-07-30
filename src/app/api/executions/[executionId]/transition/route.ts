import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, isRecordInScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import {
  archiveExecution,
  blockExecution,
  cancelExecution,
  completeExecution,
  failExecution,
  getExecutionById,
  markExecutionReady,
  pauseExecution,
  recoverExecution,
  resumeExecution,
  waitExecution,
  startExecution,
} from "@/modules/foundation/execution-repository";
import type { PermissionAction } from "@/modules/foundation/types";

const ACTION_PERMISSIONS: Record<string, PermissionAction> = {
  ready: "executions:update",
  wait: "executions:update",
  start: "executions:update",
  pause: "executions:pause",
  resume: "executions:resume",
  block: "executions:update",
  complete: "executions:update",
  cancel: "executions:cancel",
  fail: "executions:update",
  recover: "executions:update",
  archive: "executions:archive",
};

export async function POST(request: NextRequest, context: { params: Promise<{ executionId: string }> }) {
  const body = (await request.json()) as { action?: string; reason?: string };
  const action = body.action ?? "";
  const permission = ACTION_PERMISSIONS[action];
  if (!permission) {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const auth = authorizeRequest(request, permission);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { executionId } = await context.params;
  const execution = getExecutionById(executionId);
  if (!execution) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope) || !isRecordInScope({ recordOrganizationId: execution.organizationId, recordSiteId: execution.lineage.siteReference, scope })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actor = request.headers.get("x-gcp-actor") ?? "api";
  const reason = body.reason;

  const result =
    action === "ready" ? markExecutionReady({ executionId, actor, reason }) :
    action === "wait" ? waitExecution({ executionId, actor, reason }) :
    action === "start" ? startExecution({ executionId, actor, reason }) :
    action === "pause" ? pauseExecution({ executionId, actor, reason }) :
    action === "resume" ? resumeExecution({ executionId, actor, reason }) :
    action === "block" ? blockExecution({ executionId, actor, reason }) :
    action === "complete" ? completeExecution({ executionId, actor, reason }) :
    action === "cancel" ? cancelExecution({ executionId, actor, reason }) :
    action === "fail" ? failExecution({ executionId, actor, reason }) :
    action === "recover" ? recoverExecution({ executionId, actor, reason }) :
    archiveExecution({ executionId, actor, reason });

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  return NextResponse.json({ execution: result.execution });
}
