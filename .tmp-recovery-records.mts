import { getPrismaClient } from "./src/lib/glw/prisma";
const prisma = getPrismaClient();
const recs = await prisma.gopRecoveryRecord.findMany({ orderBy: { createdAt: 'desc' }, take: 20, select: { jobId: true, executionId: true, dryRun: true, safeRecovery: true, createdAt: true, metadata: true } });
console.log(JSON.stringify({ count: recs.length, recs }, null, 2));