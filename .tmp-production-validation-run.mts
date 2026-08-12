import { createPrismaGlwJobRepository } from "./src/lib/glw/job-repository";
import { createGlwN8nTransport } from "./src/lib/glw/n8n";
import { submitGlwPageGenerationJob } from "./src/lib/glw/page-generation";

(async () => {
  const repository = createPrismaGlwJobRepository();
  const workflow = createGlwN8nTransport();
  const request = {
    siteId: "led-display-warehouse",
    workspaceId: "glw-led-display-warehouse",
    pageType: "state_service" as const,
    productTopic: "direct view led video walls",
    state: "Texas",
    city: "Texas",
    citySlug: "tx",
    hierarchicalSlug: "direct_view_led_video_walls/tx",
    additionalInstructions: "Create the missing state parent for Texas.",
    title: "Direct View LED Video Walls in Texas",
    targetSlug: "tx",
    primaryKeyword: "direct view led video walls texas",
    secondaryKeywords: ["direct view led video walls", "Texas"],
    wordCount: 1200,
    tone: "Professional",
    audience: "Commercial buyers",
    callToAction: "Request a quote",
    category: "direct view led video walls",
    status: "publish" as const,
  };

  const appUrl = process.env.GLW_APP_URL as string;
  const submission = await submitGlwPageGenerationJob(request, { repository, workflow, appUrl });
  const jobId = submission.job.id;
  const lifecycle: Array<{ at: string; status: string; externalExecutionId: string | null; updatedAt: string }> = [];

  let current = await repository.findById(jobId);
  if (!current) throw new Error(`Job not found immediately after submit: ${jobId}`);
  lifecycle.push({ at: new Date().toISOString(), status: current.status, externalExecutionId: current.externalExecutionId, updatedAt: current.updatedAt });

  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    if (current.status === "COMPLETE" || current.status === "FAILED" || current.status === "FAILED_QA") break;
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const latest = await repository.findById(jobId);
    if (!latest) throw new Error(`Job missing during polling: ${jobId}`);
    current = latest;
    const last = lifecycle[lifecycle.length - 1];
    if (!last || last.status !== current.status || last.externalExecutionId !== current.externalExecutionId) {
      lifecycle.push({ at: new Date().toISOString(), status: current.status, externalExecutionId: current.externalExecutionId, updatedAt: current.updatedAt });
    }
  }

  const finalJob = await repository.findById(jobId);
  if (!finalJob) throw new Error(`Job missing at end of polling: ${jobId}`);

  console.log(JSON.stringify({
    target: {
      product: request.productTopic,
      state: request.state,
      city: request.city,
      canonicalHierarchy: request.hierarchicalSlug,
      expectedUrl: `https://leddisplaywarehouse.com/${request.hierarchicalSlug}/`,
      expectedParentIds: { product: "direct_view_led_video_walls", state: "TX" },
      publishingMode: request.status,
    },
    acceptedResponse: {
      workflowStatus: submission.workflowStatus,
      executionId: submission.job.externalExecutionId,
      result: submission.job.result,
      error: submission.job.error,
    },
    lifecycle,
    finalJob: {
      id: finalJob.id,
      status: finalJob.status,
      externalExecutionId: finalJob.externalExecutionId,
      startedAt: finalJob.startedAt,
      completedAt: finalJob.completedAt,
      result: finalJob.result,
      error: finalJob.error,
      updatedAt: finalJob.updatedAt,
    },
  }, null, 2));
})();