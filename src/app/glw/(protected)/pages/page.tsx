import { GlwPageGenerationWorkspace } from "@/components/glw/glw-page-generation-workspace";
import { createPrismaGlwJobRepository } from "@/lib/glw/job-repository";

export default async function GlwPagesPage() {
  const repository = createPrismaGlwJobRepository();
  const initialJobs = await repository.findRecentPageGenerationJobs(25);
  const initialSelectedJob = null;

  return (
    <GlwPageGenerationWorkspace
      initialJobs={initialJobs}
      initialSelectedJob={initialSelectedJob}
    />
  );
}
