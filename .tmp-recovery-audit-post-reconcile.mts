import { createJobRecoveryService } from "./src/lib/runtime/job-recovery/service";
const svc = createJobRecoveryService();
const audit = await svc.runAudit();
const buckets = audit.rows.reduce((acc, row) => { acc[row.classification] = (acc[row.classification] ?? 0) + 1; return acc; }, {} as Record<string, number>);
console.log(JSON.stringify({ generatedAt: audit.generatedAt, summary: audit.summary, cards: audit.cards, buckets, sample: audit.rows.slice(0, 6) }, null, 2));