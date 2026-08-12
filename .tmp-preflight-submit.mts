import { createPrismaGlwJobRepository } from "./src/lib/glw/job-repository";
import { createDefaultGlwThrottlePolicy, generateGlwDailyPublishPlan } from "./src/lib/glw/publishing-plan";
import { getGlwPublishingControl } from "./src/lib/glw/publishing-plan-store";

const repository = createPrismaGlwJobRepository();
const existingJobs = (await repository.findPageGenerationJobs(500)).filter((job) => job.siteId === "led-display-warehouse");
const plan = generateGlwDailyPublishPlan({ siteId: "led-display-warehouse", existingJobs, limits: createDefaultGlwThrottlePolicy("led-display-warehouse") });
const control = await getGlwPublishingControl("led-display-warehouse", true);
const activeJobs = existingJobs.filter((job) => ["QUEUED", "STARTING", "RUNNING"].includes(job.status));
const chosen = plan.approved.find((candidate) => candidate.desiredAction === "CREATE_STATE" && candidate.productId === "direct_view_led_video_walls" && candidate.stateSlug.toUpperCase() === "TX");
console.log(JSON.stringify({
  control,
  activeJobs: activeJobs.map((job) => ({ id: job.id, status: job.status, executionId: job.externalExecutionId, title: job.title })),
  chosen,
  planSummary: plan.summary,
}, null, 2));