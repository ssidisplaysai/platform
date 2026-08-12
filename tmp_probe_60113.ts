import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const main = async () => {
  const byExternal = await prisma.glwJob.findMany({ where: { externalExecutionId: "60113" }, orderBy: { createdAt: "desc" } });
  const byResult = await prisma.glwJob.findMany({ where: { result: { path: ["executionId"], equals: "60113" as any } as any }, orderBy: { createdAt: "desc" } });
  const rows = [...byExternal, ...byResult.filter(r => !byExternal.some(x => x.id === r.id))].map((r) => ({
    id: r.id,
    status: r.status,
    title: r.title,
    siteId: r.siteId,
    externalExecutionId: r.externalExecutionId,
    result: r.result,
    error: r.error,
    startedAt: r.startedAt,
    completedAt: r.completedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
  console.log(JSON.stringify({ count: rows.length, rows }, null, 2));
};
main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });