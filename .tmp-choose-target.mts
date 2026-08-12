import { createPrismaGlwJobRepository } from "./src/lib/glw/job-repository";
import { generateGlwDailyPublishPlan, createDefaultGlwThrottlePolicy } from "./src/lib/glw/publishing-plan";
const repository = createPrismaGlwJobRepository();
const existingJobs = (await repository.findPageGenerationJobs(500)).filter((job) => job.siteId === "led-display-warehouse");
const plan = generateGlwDailyPublishPlan({ siteId: "led-display-warehouse", existingJobs, limits: createDefaultGlwThrottlePolicy("led-display-warehouse") });
const chosen = plan.approved.find((candidate) => candidate.desiredAction === "CREATE_STATE" && candidate.productId === "direct_view_led_video_walls" && candidate.stateSlug.toUpperCase() === "TX");
console.log(JSON.stringify(chosen, null, 2));