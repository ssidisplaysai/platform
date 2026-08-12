import fs from "node:fs";
import { createJobRecoveryService } from "./src/lib/runtime/job-recovery/service";

const svc = createJobRecoveryService();
const audit = await svc.runAudit();
const rows = audit.rows;
const productionRows = rows.filter((row) => !row.jobId.startsWith('glw_') ? true : row.classification !== 'F');
const prodStarting = rows.filter((row) => row.classification !== 'F' && row.status === 'STARTING');
const prodRunning = rows.filter((row) => row.classification !== 'F' && row.status === 'RUNNING');
const prodRecoverable = rows.filter((row) => row.classification !== 'F' && row.safeToRecover).length;
const prodUnknown = rows.filter((row) => row.classification !== 'F' && row.classification === 'UNKNOWN').length;
const prodBucketCounts = rows.filter((row) => row.classification !== 'F').reduce((acc, row) => { acc[row.classification] = (acc[row.classification] ?? 0) + 1; return acc; }, {});
const prodStartingCount = prodStarting.length;
const prodQueueHealth = Math.max(0, 100 - (prodStartingCount * 4) - (prodUnknown * 5) - (prodRecoverable * 2));
const prodReadiness = Math.max(0, 100 - (prodUnknown * 10) - (prodRecoverable * 10) - (prodStartingCount * 6));
const snapshot = {
  generatedAt: audit.generatedAt,
  workspaceId: audit.workspaceId,
  raw: {
    starting: rows.filter((r) => r.status === 'STARTING').length,
    running: rows.filter((r) => r.status === 'RUNNING').length,
    recoverable: rows.filter((r) => r.safeToRecover).length,
    unknown: rows.filter((r) => r.classification === 'G').length,
    workers: audit.cards.workers,
    leases: rows.filter((r) => Boolean(r.leaseId)).length,
    capacity: audit.cards.queueCapacity,
    concurrency: audit.cards.concurrencyRemaining,
    callbacksPending: rows.filter((r) => !r.callbackReceived).length,
    executionStates: rows.reduce((acc, r) => { const key = r.n8nAudit?.state ?? r.n8nAudit?.reason ?? 'unknown'; acc[key] = (acc[key] ?? 0) + 1; return acc; }, {}),
  },
  productionVisible: {
    starting: prodStartingCount,
    running: prodRunning.length,
    recoverable: prodRecoverable,
    unknown: prodUnknown,
    workers: audit.cards.workers,
    leases: rows.filter((r) => Boolean(r.leaseId) && r.classification !== 'F').length,
    capacity: audit.cards.queueCapacity,
    concurrency: audit.cards.concurrencyRemaining,
    callbacksPending: rows.filter((r) => !r.callbackReceived && r.classification !== 'F').length,
    bucketCounts: prodBucketCounts,
    queueHealth: Number(prodQueueHealth.toFixed(1)),
    readiness: Number(prodReadiness.toFixed(1)),
  },
  fIds: rows.filter((r) => r.classification === 'F').map((r) => r.jobId),
  aIds: rows.filter((r) => r.classification === 'A').map((r) => r.jobId),
};
fs.writeFileSync('.tmp-genesis-reconciliation-snapshot.json', JSON.stringify(snapshot, null, 2));
console.log(JSON.stringify(snapshot, null, 2));