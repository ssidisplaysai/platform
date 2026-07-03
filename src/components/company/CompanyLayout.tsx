import { ReactNode } from "react";
import { CompanyHeader } from "./CompanyHeader";
import { MetricsGrid } from "./MetricsGrid";

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

      <MetricsGrid />

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        {children}
      </section>
    </main>
  );
}