import { MetricCard } from "@/components/metrics/MetricCard";

export function ProjectStats() {
  return (
    <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Active Projects"
        value="3"
        helperText="Currently in motion"
      />

      <MetricCard
        label="Planning"
        value="1"
        helperText="Projects being scoped"
      />

      <MetricCard
        label="Completed"
        value="0"
        helperText="Closed projects"
      />

      <MetricCard
        label="At Risk"
        value="0"
        helperText="Needs attention"
      />
    </section>
  );
}