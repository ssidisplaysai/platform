import fs from "node:fs";
import { createJobRecoveryService } from "./src/lib/runtime/job-recovery/service";

const data = JSON.parse(fs.readFileSync('.tmp-genesis-operational-forensics.json', 'utf8'));
const bucketAIds = data.rows.filter((row: any) => row.classification === 'A').map((row: any) => row.jobId);
if (bucketAIds.length === 0) throw new Error('No Bucket A jobs found');

const svc = createJobRecoveryService();
const result = await svc.executeRecovery({
  actorId: 'genesis-operational-reconciliation',
  mode: 'RECOVER_SELECTED_SAFE',
  selectedJobIds: bucketAIds,
  reason: 'Genesis production queue reconciliation: Bucket A confirmed terminal n8n ERROR and safe recovery.',
  approvalToken: 'APPROVE_RECOVERY_WRITE',
  dryRun: false,
});

console.log(JSON.stringify({ bucketAIds, result }, null, 2));