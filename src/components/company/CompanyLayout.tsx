import { ReactNode } from "react";
import { CompanyHeader } from "./CompanyHeader";
import { MetricCard } from "@/components/metrics/MetricCard";

type CompanyLayoutProps = {
  name: string;
  description: string;
  accentColor?: string;
  children: ReactNode;
};

export function CompanyLayout({
  name,
  description,
  accentColor,
  children,
}: CompanyLayoutProps) {
  return (
    <main className="space-y-8">
      <CompanyHeader
        name={name}
        description={description}
        accentColor={accentColor}
      />

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

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        {children}
      </section>
    </main>
  );
}