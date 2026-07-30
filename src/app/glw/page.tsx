import { AppShell } from "@/components/layout/app-shell";
import { GlwDashboard } from "@/modules/glw/GlwDashboard";

export default function GlwPage() {
  return (
    <AppShell>
      <GlwDashboard />
    </AppShell>
  );
}
