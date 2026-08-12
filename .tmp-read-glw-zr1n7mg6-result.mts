import { createPrismaGlwJobRepository } from "./src/lib/glw/job-repository";

(async () => {
  const repo = createPrismaGlwJobRepository();
  const job = await repo.findById('glw_zr1n7mg6');
  console.log(JSON.stringify(job?.result ?? null, null, 2));
})();