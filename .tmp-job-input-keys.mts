import { getPrismaClient } from "./src/lib/glw/prisma";
const prisma = getPrismaClient();
const job = await prisma.glwJob.findUnique({ where: { id: "glw_5jnjskze" } });
console.log(JSON.stringify({
  inputKeys: job?.input ? Object.keys(job.input.page).sort() : [],
  inputPage: job?.input.page ?? null,
}, null, 2));
await prisma.$disconnect();