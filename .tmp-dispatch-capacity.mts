import { createPrismaGlwJobRepository } from "./src/lib/glw/job-repository";
import { computeDispatchConcurrency } from "./src/lib/glw/publishing-plan-api";
import { createDefaultGlwThrottlePolicy } from "./src/lib/glw/publishing-plan";
const repository = createPrismaGlwJobRepository();
const jobs = (await repository.findPageGenerationJobs(500)).filter((job) => job.siteId === "led-display-warehouse");
const result = computeDispatchConcurrency({ siteJobs: jobs, maxConcurrentJobs: createDefaultGlwThrottlePolicy("led-display-warehouse").maxConcurrentJobs, startingTimeoutMs: 30 * 60 * 1000 });
console.log(JSON.stringify({ activeCount: result.activeCount, concurrencyRemaining: result.concurrencyRemaining, activeJobs: jobs.filter((job) => ["QUEUED", "STARTING", "RUNNING"].includes(job.status)).map((job) => ({ id: job.id, status: job.status, startedAt: job.startedAt, createdAt: job.createdAt, title: job.title })) }, null, 2));