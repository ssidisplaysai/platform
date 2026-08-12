import { getPrismaClient } from "./src/lib/glw/prisma";
const prisma = getPrismaClient();
const jobs = await prisma.glwJob.findMany({
  where: { siteId: "led-display-warehouse", status: "COMPLETE" },
  select: { id: true, input: true, result: true, externalExecutionId: true, createdAt: true },
  orderBy: { createdAt: "desc" },
  take: 50,
});
const statePages = jobs.filter((job) => job.input.page.pageType === "state_service").slice(0, 12).map((job) => ({
  id: job.id,
  title: job.input.page.title,
  state: job.input.page.state,
  city: job.input.page.city,
  product: job.input.page.productTopic,
  hierarchicalSlug: job.input.page.hierarchicalSlug,
  targetSlug: job.input.page.targetSlug,
  wordpressUrl: job.result?.wordpressUrl ?? null,
  wordpressPageId: job.result?.wordpressPageId ?? null,
  wordpressPostId: job.result?.wordpressPostId ?? null,
  externalExecutionId: job.externalExecutionId,
}));
console.log(JSON.stringify(statePages, null, 2));
await prisma.$disconnect();