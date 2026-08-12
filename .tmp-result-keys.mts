import { getPrismaClient } from "./src/lib/glw/prisma";
const prisma = getPrismaClient();
const job = await prisma.glwJob.findUnique({ where: { id: "glw_5jnjskze" } });
const result = job?.result ?? null;
console.log(JSON.stringify({
  id: job?.id,
  status: job?.status,
  resultKeys: result ? Object.keys(result) : [],
  hasCallbackFields: result ? ["wordpressStatus", "requestedPublishingMode", "disposition", "qaChecks", "qaFailureReasons"].every((key) => key in result) : false,
  result,
}, null, 2));
await prisma.$disconnect();