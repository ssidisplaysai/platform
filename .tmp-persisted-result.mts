import { getPrismaClient } from "./src/lib/glw/prisma";
const prisma = getPrismaClient();
const job = await prisma.glwJob.findUnique({ where: { id: "glw_5jnjskze" } });
console.log(JSON.stringify({
  persistedResultKeys: job?.result ? Object.keys(job.result) : [],
  persistedResult: job?.result ?? null,
}, null, 2));
await prisma.$disconnect();