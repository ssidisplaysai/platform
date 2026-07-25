import { GlwQueueWorkspace } from "@/components/glw/glw-queue-workspace";
import { createPrismaGlwJobRepository } from "@/lib/glw/job-repository";
import { matchesGlwJobFilter } from "@/lib/glw/jobs";

export default async function GlwQueuePage() {
  const repository = createPrismaGlwJobRepository();
  const jobs = await repository.findPageGenerationJobs(200);
  const initialJobs = jobs.filter((job) => matchesGlwJobFilter(job.status, "active"));

  return <GlwQueueWorkspace initialJobs={initialJobs} />;
}
