import { createJobRecoveryService } from "./src/lib/runtime/job-recovery/service";

const svc = createJobRecoveryService();
const audit = await svc.runAudit();
console.log(JSON.stringify({ generatedAt: audit.generatedAt, summary: audit.summary, cards: audit.cards }, null, 2));