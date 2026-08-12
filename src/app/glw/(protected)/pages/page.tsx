import { GlwPageGenerationWorkspace } from "@/components/glw/glw-page-generation-workspace";
import { createPrismaGlwJobRepository } from "@/lib/glw/job-repository";
import type { GlwJobRecord } from "@/lib/glw/jobs";

function pickInitialSelectedJob(jobs: GlwJobRecord[]): GlwJobRecord | null {
  const active = jobs.find((job) =>
    job.status === "QUEUED"
    || job.status === "STARTING"
    || job.status === "RUNNING"
    || job.status === "GENERATING_CONTENT"
    || job.status === "GENERATING_IMAGE"
    || job.status === "UPLOADING_IMAGE"
    || job.status === "PUBLISHING",
  );

  return active ?? jobs[0] ?? null;
}

export default async function GlwPagesPage() {
  const repository = createPrismaGlwJobRepository();

  let initialJobs: GlwJobRecord[] = [];
  try {
    initialJobs = await repository.findPageGenerationJobs(200);
  } catch {
    initialJobs = [];
  }

  return (
    <GlwPageGenerationWorkspace
      initialJobs={initialJobs}
      initialSelectedJob={pickInitialSelectedJob(initialJobs)}
    />
  );
}
