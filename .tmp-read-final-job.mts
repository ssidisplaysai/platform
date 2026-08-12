import { getPrismaClient } from "./src/lib/glw/prisma";
const prisma = getPrismaClient();
const job = await prisma.glwJob.findUnique({ where: { id: "glw_5jnjskze" } });
console.log(JSON.stringify(job, null, 2));
await prisma.$disconnect();