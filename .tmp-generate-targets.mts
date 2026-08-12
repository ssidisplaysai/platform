import { createPrismaGlwJobRepository } from "./src/lib/glw/job-repository";
import { generateGlwDailyPublishPlan, createDefaultGlwThrottlePolicy } from "./src/lib/glw/publishing-plan";

const repository = createPrismaGlwJobRepository();
const existingJobs = (await repository.findPageGenerationJobs(500)).filter((job) => job.siteId === "led-display-warehouse");
const plan = generateGlwDailyPublishPlan({ siteId: "led-display-warehouse", existingJobs, limits: createDefaultGlwThrottlePolicy("led-display-warehouse") });
const candidates = plan.approved
  .filter((candidate) => candidate.desiredAction !== "SKIP_EXISTING")
  .filter((candidate) => !/houston|qa|phase13|test|dummy|synthetic/i.test([candidate.productSlug, candidate.stateName, candidate.cityName ?? "", candidate.canonicalPath].join(" ")))
  .map((candidate) => ({
    product: candidate.productSlug,
    state: candidate.stateName,
    city: candidate.cityName ?? null,
    canonicalPath: candidate.canonicalPath,
    expectedUrl: `https://leddisplaywarehouse.com/${candidate.canonicalPath}/`,
    parentProductId: candidate.parentProductId ?? null,
    parentStateId: candidate.parentStateId ?? null,
    desiredAction: candidate.desiredAction,
    reason: candidate.reason,
  }));
console.log(JSON.stringify({ summary: plan.summary, totalCandidates: plan.candidates.length, candidates: candidates.slice(0, 12) }, null, 2));