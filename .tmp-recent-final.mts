import { createPrismaGlwJobRepository } from "./src/lib/glw/job-repository";
const repository = createPrismaGlwJobRepository();
const recent = await repository.findRecentPageGenerationJobs(5);
console.log(JSON.stringify(recent.map((job) => ({ id: job.id, status: job.status, title: job.title, result: job.result, error: job.error, externalExecutionId: job.externalExecutionId, updatedAt: job.updatedAt })), null, 2));