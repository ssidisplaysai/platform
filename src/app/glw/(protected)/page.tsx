import { GlwDashboard } from "@/components/glw/glw-dashboard";
import { createPrismaGlwJobRepository } from "@/lib/glw/job-repository";
import { matchesGlwJobFilter } from "@/lib/glw/jobs";

export default async function GlwHomePage() {
  const repository = createPrismaGlwJobRepository();
  const jobs = await repository.findPageGenerationJobs(500);
  const recentJobs = jobs.slice(0, 20);

  const completedDurations = jobs
    .filter((job) => job.status === "COMPLETE" && job.startedAt && job.completedAt)
    .map((job) => new Date(job.completedAt as string).getTime() - new Date(job.startedAt as string).getTime())
    .filter((durationMs) => durationMs >= 0);

  const avgDurationMs = completedDurations.length > 0
    ? Math.round(completedDurations.reduce((sum, value) => sum + value, 0) / completedDurations.length)
    : 0;

  return (
    <GlwDashboard
      metrics={{
        total: jobs.length,
        active: jobs.filter((job) => matchesGlwJobFilter(job.status, "active")).length,
        complete: jobs.filter((job) => job.status === "COMPLETE").length,
        failed: jobs.filter((job) => job.status === "FAILED").length,
        avgDurationMs,
      }}
      recentJobs={recentJobs}
    />
  );
}
