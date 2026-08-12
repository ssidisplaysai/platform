import fs from "node:fs";
import { createGlwN8nExecutionService } from "./src/lib/glw/n8n";
import { getPrismaClient } from "./src/lib/glw/prisma";

const prisma = getPrismaClient();
const n8n = createGlwN8nExecutionService();

function safeString(v: unknown): string { return typeof v === "string" ? v : ""; }
function asObj(v: unknown): Record<string, unknown> { return (typeof v === "object" && v !== null) ? (v as Record<string, unknown>) : {}; }

function parsePage(job: any) {
  const input = asObj(job.input);
  const page = asObj(input.page);
  const product = safeString(page.productTopic || page.product_topic);
  const state = safeString(page.state);
  const city = safeString(page.city);
  const citySlug = safeString(page.citySlug || page.city_slug);
  const canonicalPath = safeString(page.hierarchicalSlug || page.hierarchical_slug || page.targetSlug || page.target_slug);
  return { product, state, city, citySlug, canonicalPath };
}

function parseResult(result: any) {
  const r = asObj(result);
  return {
    status: safeString(r.status),
    executionId: safeString(r.executionId),
    wordpressStatus: safeString(r.wordpressStatus),
    requestedPublishingMode: safeString(r.requestedPublishingMode),
    disposition: safeString(r.disposition),
    hasQaChecks: typeof r.qaChecks === "object" && r.qaChecks !== null,
  };
}

async function fetchExecutionRaw(executionId: string) {
  const apiKey = (process.env.GLW_N8N_API_KEY || "").trim();
  const webhook = (process.env.GLW_N8N_PAGE_WEBHOOK_URL || "").trim();
  if (!apiKey || !webhook || !/^\d+$/.test(executionId)) return null;
  try {
    const origin = new URL(webhook).origin;
    const url = `${origin}/api/v1/executions/${encodeURIComponent(executionId)}?includeData=true`;
    const res = await fetch(url, { headers: { "X-N8N-API-KEY": apiKey, Accept: "application/json" } });
    if (!res.ok) return { httpStatus: res.status, payload: null };
    const payload = await res.json().catch(() => null);
    return { httpStatus: res.status, payload };
  } catch (error) {
    return { httpStatus: -1, error: error instanceof Error ? error.message : String(error), payload: null };
  }
}

function extractRunData(payload: any): Record<string, unknown> {
  const root = asObj(payload);
  const data = asObj(root.data);
  const resultData = asObj(data.resultData);
  const runData = asObj(resultData.runData);
  return runData;
}

function callbackNodeForensics(runData: Record<string, unknown>) {
  const nodeNames = Object.keys(runData);
  const callbackNodes = nodeNames.filter((n) => /callback/i.test(n));
  if (callbackNodes.length === 0) {
    return { callbackNodeSeen: false, callbackNodeNames: [], callbackNodeErrors: [], callbackNodeSuccessCount: 0 };
  }

  const callbackNodeErrors: string[] = [];
  let callbackNodeSuccessCount = 0;

  for (const name of callbackNodes) {
    const entries = runData[name];
    if (!Array.isArray(entries)) continue;
    for (const run of entries) {
      if (!Array.isArray(run)) continue;
      for (const item of run) {
        const obj = asObj(item);
        const err = asObj(obj.error);
        if (Object.keys(err).length > 0) {
          callbackNodeErrors.push(`${name}:${safeString(err.message) || "error"}`);
        } else {
          callbackNodeSuccessCount += 1;
        }
      }
    }
  }

  return {
    callbackNodeSeen: true,
    callbackNodeNames: callbackNodes,
    callbackNodeErrors,
    callbackNodeSuccessCount,
  };
}

function findCallbackEvent(events: any[]) {
  const matches = events.filter((e) => {
    const et = safeString(e.eventType).toUpperCase();
    const stage = safeString(e.stage).toLowerCase();
    return et === "CALLBACK_RECEIVED" || stage === "callback";
  });
  return matches;
}

function classifyBucket(input: {
  n8nExists: string;
  n8nTerminal: boolean | null;
  callbackReceived: boolean;
  callbackNodeSeen: boolean;
  callbackNodeSuccessCount: number;
  leaseEver: boolean;
  leaseExpired: boolean;
  workerExists: boolean;
  ageHours: number;
  title: string;
  product: string;
}) {
  const title = input.title.toLowerCase();
  const product = input.product.toLowerCase();
  const testLike = /test|qa|debug|probe|smoke|validation/.test(title) || /test|qa|debug|probe|smoke|validation/.test(product);

  if (testLike) return { bucket: "F", label: "Manual testing artifact" };

  if (input.n8nExists === "missing" && input.ageHours >= 72 && !input.leaseEver) {
    return { bucket: "E", label: "Historical legacy record" };
  }

  if (input.n8nTerminal === true && !input.callbackReceived) {
    return { bucket: "A", label: "Terminal n8n execution never reconciled" };
  }

  if (input.callbackNodeSeen && input.callbackNodeSuccessCount > 0 && !input.callbackReceived) {
    return { bucket: "B", label: "Callback never arrived" };
  }

  if (input.leaseEver && input.leaseExpired && !input.workerExists && input.n8nTerminal !== true) {
    return { bucket: "C", label: "Worker crashed before callback" };
  }

  if (input.leaseEver && input.leaseExpired && input.workerExists && input.n8nTerminal !== true) {
    return { bucket: "D", label: "Lease inconsistency" };
  }

  if (input.n8nExists === "missing" && input.ageHours >= 72) {
    return { bucket: "E", label: "Historical legacy record" };
  }

  return { bucket: "G", label: "Unknown after evidence review" };
}

const jobs = await prisma.glwJob.findMany({
  where: { status: "STARTING", type: "PAGE_GENERATION" },
  orderBy: { createdAt: "asc" },
});

const jobIds = jobs.map((j) => j.id);
const events = await prisma.gopJobEvent.findMany({
  where: { jobId: { in: jobIds } },
  orderBy: [{ jobId: "asc" }, { sequence: "asc" }],
});

const eventMap = new Map<string, any[]>();
for (const e of events) {
  if (!eventMap.has(e.jobId)) eventMap.set(e.jobId, []);
  eventMap.get(e.jobId)!.push(e);
}

const now = Date.now();
const rows: any[] = [];
for (const job of jobs) {
  const page = parsePage(job);
  const result = parseResult(job.result);
  const executionId = (job.externalExecutionId || result.executionId || "").trim();

  const exec = await prisma.gopExecution.findFirst({
    where: {
      OR: [
        { jobId: job.id },
        ...(executionId ? [{ executionId }] : []),
      ],
    },
    include: { leases: { orderBy: { leaseStartAt: "desc" } } },
  });

  const latestLease = exec?.leases?.[0] ?? null;
  const leaseEver = Boolean(exec?.leases?.length);
  const leaseExpired = latestLease ? latestLease.leaseExpiresAt.getTime() < now : false;
  const leaseRenewed = exec?.leases?.some((l: any) => l.renewalCount > 0) ?? false;

  const workerId = latestLease?.workerId || "";
  const worker = workerId ? await prisma.gopWorker.findUnique({ where: { workerId } }) : null;
  const workerExists = Boolean(worker);
  const workerHeartbeatExpired = worker
    ? (now - worker.heartbeatAt.getTime()) > Math.max((worker.heartbeatIntervalMs ?? 30000) * 3, 120000)
    : (latestLease ? latestLease.heartbeatDeadlineAt.getTime() < now : false);

  const n8nDiag = executionId ? await n8n.getExecutionDiagnostics(executionId) : { available: false, reason: "No execution id", deepLinkUrl: null } as any;
  const n8nState = n8nDiag.available ? n8nDiag.diagnostics.executionState : null;
  const n8nTerminal = n8nDiag.available ? Boolean(n8nDiag.diagnostics.terminal) : null;
  const n8nExists = n8nDiag.available ? "exists" : ((n8nDiag.upstreamStatus === 404 || /missing/i.test(n8nDiag.reason || "")) ? "missing" : "unreachable");

  const raw = executionId ? await fetchExecutionRaw(executionId) : null;
  const runData = raw && raw.payload ? extractRunData(raw.payload) : {};
  const callbackNode = callbackNodeForensics(runData);

  const jobEvents = eventMap.get(job.id) ?? [];
  const callbackEvents = findCallbackEvent(jobEvents);
  const callbackReceived = callbackEvents.length > 0;
  const callbackReceivedAt = callbackReceived ? callbackEvents[0].occurredAt.toISOString() : null;

  let callbackStatus = "Callback missing";
  let callbackWhy = "No callback event recorded in GopJobEvent.";
  if (callbackReceived) {
    const hasPersisted = result.status === "COMPLETE" || result.status === "FAILED" || result.status === "FAILED_QA";
    if (hasPersisted) {
      callbackStatus = "Callback persisted";
      callbackWhy = "Callback event recorded and terminal result fields persisted.";
    } else {
      callbackStatus = "Callback partially persisted";
      callbackWhy = "Callback event exists but job/result remained non-terminal.";
    }
  } else if (callbackNode.callbackNodeSeen && callbackNode.callbackNodeSuccessCount > 0) {
    callbackStatus = "Callback sent";
    callbackWhy = "n8n callback node executed successfully but no callback event found in platform events.";
  } else if (callbackNode.callbackNodeSeen && callbackNode.callbackNodeErrors.length > 0) {
    callbackStatus = "Callback missing";
    callbackWhy = `n8n callback node errored: ${callbackNode.callbackNodeErrors.slice(0,2).join("; ")}`;
  } else if (n8nDiag.available && n8nDiag.diagnostics.terminal) {
    callbackStatus = "Callback missing";
    callbackWhy = "n8n execution terminal but callback node evidence is absent in runData.";
  } else if (n8nDiag.available && !n8nDiag.diagnostics.terminal) {
    callbackStatus = "Callback pending";
    callbackWhy = "n8n execution still non-terminal; callback not expected yet.";
  } else if (n8nExists === "missing") {
    callbackStatus = "Callback missing";
    callbackWhy = "n8n execution record missing (404/missing), so callback evidence cannot be produced.";
  } else {
    callbackStatus = "Callback missing";
    callbackWhy = `n8n diagnostics unavailable: ${n8nDiag.reason || "unknown"}`;
  }

  const ageHours = Number(((now - job.createdAt.getTime()) / 3600000).toFixed(2));

  const bucket = classifyBucket({
    n8nExists,
    n8nTerminal,
    callbackReceived,
    callbackNodeSeen: callbackNode.callbackNodeSeen,
    callbackNodeSuccessCount: callbackNode.callbackNodeSuccessCount,
    leaseEver,
    leaseExpired,
    workerExists,
    ageHours,
    title: job.title,
    product: page.product,
  });

  const safeAction = (() => {
    switch (bucket.bucket) {
      case "A": return "Replay callback then mark failed if replay not possible";
      case "B": return "Replay callback payload";
      case "C": return "Mark failed then retry";
      case "D": return "Manual lease reconciliation then retry";
      case "E": return "Manual review then mark failed as legacy";
      case "F": return "Leave alone or archive from operational queue";
      default: return "Manual review";
    }
  })();

  const preventionSubsystem = (() => {
    switch (bucket.bucket) {
      case "A": return "Callback Contract + Recovery Engine";
      case "B": return "Callback Contract + Runtime Health";
      case "C": return "Worker Manager + Runtime Health";
      case "D": return "Lease Manager + Operations Center";
      case "E": return "Recovery Engine + Operations Center";
      case "F": return "Operations Center";
      default: return "Runtime Health + Operations Center";
    }
  })();

  rows.push({
    jobId: job.id,
    created: job.createdAt.toISOString(),
    updated: job.updatedAt.toISOString(),
    ageHours,
    site: job.siteId,
    workflow: page.canonicalPath ? "PAGE_GENERATION" : "UNKNOWN",
    product: page.product,
    state: page.state,
    city: page.city || page.citySlug,
    canonicalPath: page.canonicalPath,
    worker: worker ? `${worker.workerId} (${worker.health})` : null,
    leaseOwner: latestLease?.workerId ?? null,
    leaseExpiration: latestLease?.leaseExpiresAt?.toISOString() ?? null,
    heartbeat: worker?.heartbeatAt?.toISOString() ?? (latestLease?.heartbeatDeadlineAt?.toISOString() ?? null),
    executionId,
    currentStatus: job.status,
    retryCount: exec?.retryCount ?? 0,
    callbackReceived,
    callbackReceivedAt,
    classification: bucket.bucket,
    classificationLabel: bucket.label,
    callbackStatus,
    callbackWhy,
    n8nAudit: {
      exists: n8nExists,
      available: n8nDiag.available,
      state: n8nState,
      terminal: n8nTerminal,
      reason: n8nDiag.available ? null : (n8nDiag.reason ?? null),
      upstreamStatus: (n8nDiag as any).upstreamStatus ?? null,
      deepLinkUrl: (n8nDiag as any).deepLinkUrl ?? null,
    },
    workerForensics: {
      workerAccepted: latestLease?.workerId ?? null,
      workerStillExists: workerExists,
      workerHeartbeatExpired,
      workerRestartEvidence: exec?.leases && exec.leases.length > 1 ? "multiple_lease_records" : "none",
      workerCrashEvidence: leaseExpired && !workerExists ? "lease_expired_and_worker_missing" : "none",
    },
    leaseForensics: {
      leaseCreated: leaseEver,
      leaseRenewed,
      leaseExpired,
      leaseOrphaned: leaseEver && !workerExists,
      leaseNeverCreated: !leaseEver,
      leaseCount: exec?.leases?.length ?? 0,
    },
    recommendedAction: safeAction,
    preventionSubsystem,
  });
}

const byBucket = rows.reduce((acc: Record<string, number>, row) => {
  acc[row.classification] = (acc[row.classification] ?? 0) + 1;
  return acc;
}, {} as Record<string, number>);

const callbackIssues = rows.filter((r) => !r.callbackReceived).length;
const workerIssues = rows.filter((r) => !r.workerForensics.workerStillExists || r.workerForensics.workerHeartbeatExpired).length;
const leaseIssues = rows.filter((r) => r.leaseForensics.leaseExpired || r.leaseForensics.leaseOrphaned || r.leaseForensics.leaseNeverCreated).length;
const legacyArtifacts = rows.filter((r) => r.classification === "E" || r.classification === "F").length;
const recoverable = rows.filter((r) => ["A","B","C","D"].includes(r.classification)).length;
const manualReview = rows.filter((r) => ["E","G"].includes(r.classification)).length;
const trueUnknown = rows.filter((r) => r.classification === "G").length;

const queueHealthScore = Math.max(0, 100 - (rows.length * 1.8) - (trueUnknown * 1.5) - (workerIssues * 0.8));
const readinessScore = Math.max(0, 100 - (trueUnknown * 2) - (callbackIssues * 1.2) - (workerIssues * 1.2) - (leaseIssues * 0.8));

const output = {
  generatedAt: new Date().toISOString(),
  totalStartingJobs: rows.length,
  rows,
  scorecard: {
    jobsAudited: rows.length,
    buckets: byBucket,
    recoverable,
    needsManualReview: manualReview,
    trueUnknown,
    workerFailures: workerIssues,
    callbackFailures: callbackIssues,
    leaseFailures: leaseIssues,
    legacyArtifacts,
    queueHealthScore: Number(queueHealthScore.toFixed(1)),
    operationalReadinessScore: Number(readinessScore.toFixed(1)),
  },
};

fs.writeFileSync(".tmp-genesis-operational-forensics.json", JSON.stringify(output, null, 2));
console.log(JSON.stringify({
  file: ".tmp-genesis-operational-forensics.json",
  totalStartingJobs: output.totalStartingJobs,
  scorecard: output.scorecard,
}, null, 2));