import { GlwPageGenerationWorkspace } from "@/components/glw/glw-page-generation-workspace";
import { createPrismaGlwJobRepository } from "@/lib/glw/job-repository";
import type { GlwJobRecord } from "@/lib/glw/jobs";

type GlwPagesSearchParams = {
  create?: string | string[];
};

function isCreateModeEnabled(value: string | string[] | undefined): boolean {
  if (Array.isArray(value)) {
    return isCreateModeEnabled(value[0]);
  }

  if (typeof value !== "string") {
    return false;
  }

  return value.trim().toLowerCase() === "1";
}

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

export default async function GlwPagesPage({ searchParams }: { searchParams?: GlwPagesSearchParams | Promise<GlwPagesSearchParams> }) {
  const repository = createPrismaGlwJobRepository();
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const initialCreateMode = isCreateModeEnabled(resolvedSearchParams?.create);

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
      initialCreateMode={initialCreateMode}
    />
  );
}

export { isCreateModeEnabled };
