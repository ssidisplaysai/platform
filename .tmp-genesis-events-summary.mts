import { getPrismaClient } from "./src/lib/glw/prisma";
const prisma = getPrismaClient();
const jobs = await prisma.glwJob.findMany({ where: { status: "STARTING", type: "PAGE_GENERATION" }, select: { id: true } });
const ids = jobs.map(j=>j.id);
const events = await prisma.gopJobEvent.groupBy({ by: ['eventType'], where: { jobId: { in: ids } }, _count: { eventType: true } });
console.log(JSON.stringify({ totalJobs: ids.length, eventTypeCounts: events }, null, 2));