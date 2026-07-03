import { MetricCard } from "@/components/metrics/MetricCard";

export function MetricsGrid() {
  return (
    <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Revenue"
        value="$0"
        helperText="Current fiscal period"
      />

      <MetricCard
        label="Projects"
        value="0"
        helperText="Active projects"
      />

      <MetricCard
        label="Customers"
        value="0"
        helperText="Customer accounts"
      />

      <MetricCard
        label="Tasks"
        value="0"
        helperText="Open action items"
      />
    </section>
  );
}