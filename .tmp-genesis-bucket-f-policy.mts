import fs from "node:fs";
const data = JSON.parse(fs.readFileSync('.tmp-genesis-operational-forensics.json', 'utf8'));
const ids = data.rows.filter((row: any) => row.classification === 'F').map((row: any) => row.jobId);
console.log(JSON.stringify({ bucketFIds: ids, policy: 'exclude from production metrics' }, null, 2));