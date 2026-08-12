import { GlwDashboard } from "@/components/glw/glw-dashboard";

export default async function GlwHomePage() {
  return (
    <GlwDashboard
      metrics={{
        total: 0,
        active: 0,
        complete: 0,
        failed: 0,
        avgDurationMs: 0,
      }}
      recentJobs={[]}
    />
  );
}
