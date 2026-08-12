import { createJobRecoveryService } from "./src/lib/runtime/job-recovery/service";

const svc = createJobRecoveryService();
const audit = await svc.runAudit();
console.log(JSON.stringify({
  generatedAt: audit.generatedAt,
  summary: audit.summary,
  healthCards: audit.healthCards,
  sampleRows: audit.rows.slice(0,10).map((r) => ({
    jobId: r.jobId,
    classification: r.classification,
    safeToRecover: r.safeToRecover,
    ageHours: r.ageHours,
    leaseExpired: r.leaseExpired,
    heartbeatStopped: r.heartbeatStopped,
    executionState: r.executionState,
  }))
}, null, 2));