import { createPrismaGlwJobRepository } from "./src/lib/glw/job-repository";
import { generateGlwDailyPublishPlan, createDefaultGlwThrottlePolicy } from "./src/lib/glw/publishing-plan";

const repository = createPrismaGlwJobRepository();
const existingJobs = (await repository.findPageGenerationJobs(500)).filter((job) => job.siteId === "led-display-warehouse");
const plan = generateGlwDailyPublishPlan({ siteId: "led-display-warehouse", existingJobs, limits: createDefaultGlwThrottlePolicy("led-display-warehouse") });
const cityCandidates = plan.approved.filter((candidate) => Boolean(candidate.cityName)).map((candidate) => ({
  product: candidate.productSlug,
  state: candidate.stateName,
  city: candidate.cityName,
  canonicalPath: candidate.canonicalPath,
  expectedUrl: `https://leddisplaywarehouse.com/${candidate.canonicalPath}/`,
  parentProductId: candidate.parentProductId ?? null,
  parentStateId: candidate.parentStateId ?? null,
  desiredAction: candidate.desiredAction,
  reason: candidate.reason,
}));
console.log(JSON.stringify({ count: cityCandidates.length, cityCandidates }, null, 2));