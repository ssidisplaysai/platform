import { getPrismaClient } from "./src/lib/glw/prisma";
const prisma = getPrismaClient();
const active = await prisma.glwJob.findMany({ where: { siteId: "led-display-warehouse", status: "STARTING" }, select: { id: true, title: true, externalExecutionId: true, startedAt: true, updatedAt: true } });
console.log(JSON.stringify({ startingCount: active.length, jobs: active }, null, 2));
await prisma.$disconnect();