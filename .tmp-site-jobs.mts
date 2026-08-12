import { getPrismaClient } from "./src/lib/glw/prisma";
const prisma = getPrismaClient();
const jobs = await prisma.glwJob.findMany({ where: { siteId: "led-display-warehouse" }, select: { id: true, status: true, input: true, externalExecutionId: true, result: true, error: true, createdAt: true, updatedAt: true }, orderBy: { createdAt: "desc" } });
console.log(JSON.stringify({ count: jobs.length, sample: jobs.slice(0, 5) }, null, 2));
await prisma.$disconnect();