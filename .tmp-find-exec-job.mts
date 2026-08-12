import { getPrismaClient } from "./src/lib/glw/prisma";
const prisma = getPrismaClient();
const jobs = await prisma.glwJob.findMany({ where: { externalExecutionId: "65597" }, select: { id: true, status: true, result: true, input: true, error: true, externalExecutionId: true, updatedAt: true } });
console.log(JSON.stringify(jobs, null, 2));
await prisma.$disconnect();