import { createPrismaGlwJobRepository } from "./src/lib/glw/job-repository";
import { createGlwN8nTransport } from "./src/lib/glw/n8n";
import { submitGlwPageGenerationJob } from "./src/lib/glw/page-generation";

(async () => {
  const repository = createPrismaGlwJobRepository();
  const workflow = createGlwN8nTransport();

  const structuredCity = "Phase 13 Capacity Single 001";
  const structuredCitySlug = "phase13-capacity-single-001";

  const request = {
    siteId: "led-display-warehouse",
    workspaceId: "glw-led-display-warehouse",
    pageType: "city_service" as const,
    productTopic: "Direct View LED Video Walls",
    state: "Texas",
    city: structuredCity,
    citySlug: structuredCitySlug,
    hierarchicalSlug: `direct-view-led-video-walls/texas/${structuredCitySlug}`,
    additionalInstructions: "Controlled canonical identity test with aligned structured fields. No Houston values.",
    title: "Phase 13 Controlled Canonical Identity Validation",
    targetSlug: structuredCitySlug,
    primaryKeyword: "direct view led video walls texas",
    secondaryKeywords: ["direct view led displays", "commercial led wall texas"],
    wordCount: 920,
    tone: "professional",
    audience: "internal qa",
    callToAction: "Request a quote",
    category: "LED Displays",
    status: "publish" as const,
  };

  const appUrl = process.env.GLW_APP_URL as string;
  const submitted = await submitGlwPageGenerationJob(request, { repository, workflow, appUrl });

  const lifecycle: Array<{ at: string; status: string }> = [];
  let current = await repository.findById(submitted.job.id);
  if (!current) throw new Error("Job not found immediately after submit");
  lifecycle.push({ at: new Date().toISOString(), status: current.status });

  const deadline = Date.now() + 12 * 60 * 1000;
  while (Date.now() < deadline) {
    if (current.status === "COMPLETE" || current.status === "FAILED" || current.status === "FAILED_QA") break;
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const latest = await repository.findById(submitted.job.id);
    if (!latest) throw new Error("Job missing during polling");
    current = latest;
    const last = lifecycle[lifecycle.length - 1];
    if (!last || last.status !== current.status) {
      lifecycle.push({ at: new Date().toISOString(), status: current.status });
    }
  }

  const finalJob = await repository.findById(submitted.job.id);
  if (!finalJob) throw new Error("Job missing at end of polling");

  const out = {
    jobId: submitted.job.id,
    executionId: finalJob.externalExecutionId,
    submittedInputIdentity: {
      city: request.city,
      citySlug: request.citySlug,
      targetSlug: request.targetSlug,
      hierarchicalSlug: request.hierarchicalSlug,
      status: request.status,
    },
    callbackUrl: finalJob.input.callbackUrl,
    lifecycle,
    finalStatus: finalJob.status,
    finalResult: finalJob.result,
    finalError: finalJob.error,
  };

  console.log(JSON.stringify(out, null, 2));
})();