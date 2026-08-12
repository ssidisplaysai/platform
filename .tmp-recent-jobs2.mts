import { createPrismaGlwJobRepository } from "./src/lib/glw/job-repository";
const repository = createPrismaGlwJobRepository();
const recent = await repository.findPageGenerationJobs(12);
console.log(JSON.stringify(recent.map((job) => ({ id: job.id, status: job.status, title: job.title, city: job.input.page.city, state: job.input.page.state, targetSlug: job.input.page.targetSlug, hierarchicalSlug: job.input.page.hierarchicalSlug, externalExecutionId: job.externalExecutionId, callbackUrl: job.input.callbackUrl })).slice(0, 12), null, 2));