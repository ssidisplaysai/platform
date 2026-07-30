import { AppShell } from "@/components/layout/app-shell";
import { GlwPagesCenter } from "@/modules/glw/GlwPagesCenter";

export default function GlwPagesRoute() {
  return (
    <AppShell>
      <GlwPagesCenter />
    </AppShell>
  );
}
