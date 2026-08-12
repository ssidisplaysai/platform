import fs from "node:fs";
import path from "node:path";

function has(k:string){ const v=process.env[k]; return typeof v === 'string' && v.trim().length>0; }
const envKeys = [
  'GLW_N8N_PAGE_WEBHOOK_URL','GLW_N8N_WEBHOOK_SECRET','GLW_APP_URL',
  'GLW_WORDPRESS_APPLICATION_PASSWORD','GLW_WORDPRESS_USERNAME','GLW_WORDPRESS_SITE_URL',
  'DATABASE_URL'
];
const envStatus = Object.fromEntries(envKeys.map((k)=>[k, has(k)]));

const files = [
  'backups/n8n/glw-page-engine-v1.0.json',
  'prisma/schema.prisma',
  'src/lib/runtime/job-recovery/service.ts',
  'src/lib/glw/site-registry.ts',
  'prisma/migrations',
];
const fileStatus = Object.fromEntries(files.map((p)=>[p, fs.existsSync(path.resolve(p))]));

console.log(JSON.stringify({ envStatus, fileStatus }, null, 2));