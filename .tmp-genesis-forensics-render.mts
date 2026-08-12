import fs from "node:fs";
const data = JSON.parse(fs.readFileSync('.tmp-genesis-operational-forensics.json','utf8'));
const rows = data.rows;

function esc(v){
  if (v === null || v === undefined) return "";
  return String(v).replace(/\|/g,'\\|');
}

function toBucket(row){
  if (row.classification === 'G' && row.n8nAudit?.exists === 'unreachable' && row.n8nAudit?.upstreamStatus === 500) {
    return { code: 'H', label: 'n8n execution telemetry unreachable (HTTP 500)' };
  }
  return { code: row.classification, label: row.classificationLabel };
}

const header = [
  'Job ID','Created','Updated','Age (h)','Site','Workflow','Product','State','City','Canonical Path','Worker','Lease Owner','Lease Expiration','Heartbeat','Execution ID','Current Status','Retry Count','Callback Received','Current Classification'
];

let md = '| ' + header.join(' | ') + ' |\n';
md += '| ' + header.map(()=> '---').join(' | ') + ' |\n';

for (const r of rows) {
  const b = toBucket(r);
  const vals = [
    r.jobId,r.created,r.updated,r.ageHours,r.site,r.workflow,r.product,r.state,r.city,r.canonicalPath,
    r.worker,r.leaseOwner,r.leaseExpiration,r.heartbeat,r.executionId,r.currentStatus,r.retryCount,
    r.callbackReceived ? 'YES' : 'NO', `${b.code}: ${b.label}`
  ];
  md += '| ' + vals.map(esc).join(' | ') + ' |\n';
}

const bucketCounts = {};
for (const r of rows){
  const b = toBucket(r).code;
  bucketCounts[b] = (bucketCounts[b]||0)+1;
}

const phase2 = rows.reduce((acc,r)=>{ const k = r.n8nAudit.exists; acc[k]=(acc[k]||0)+1; return acc; },{});
const callbackBreakdown = rows.reduce((acc,r)=>{ const k = r.callbackStatus; acc[k]=(acc[k]||0)+1; return acc; },{});

const summary = {
  total: rows.length,
  bucketCounts,
  n8nAudit: phase2,
  callbackBreakdown,
  callbackReasons: rows.reduce((acc,r)=>{ acc[r.callbackWhy]=(acc[r.callbackWhy]||0)+1; return acc; },{}),
  leaseNeverCreated: rows.filter(r=>r.leaseForensics.leaseNeverCreated).length,
  workersPresent: rows.filter(r=>Boolean(r.worker)).length,
};

fs.writeFileSync('.tmp-genesis-operational-forensics-table.md', md);
fs.writeFileSync('.tmp-genesis-operational-forensics-summary.json', JSON.stringify(summary,null,2));
console.log(JSON.stringify({ table: '.tmp-genesis-operational-forensics-table.md', summary: '.tmp-genesis-operational-forensics-summary.json', summaryData: summary }, null, 2));