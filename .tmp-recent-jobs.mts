import { createPrismaGlwJobRepository } from "./src/lib/glw/job-repository";
const repository = createPrismaGlwJobRepository();
const recent = await repository.findPageGenerationJobs(20);
console.log(JSON.stringify(recent.map((job) => ({ id: job.id, status: job.status, siteId: job.siteId, title: job.title, createdAt: job.createdAt, targetSlug: job.input.page.targetSlug, city: job.input.page.city, state: job.input.page.state, productTopic: job.input.page.productTopic, hierarchicalSlug: job.input.page.hierarchicalSlug })).slice(0, 20), null, 2));