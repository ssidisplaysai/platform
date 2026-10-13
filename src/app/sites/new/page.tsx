import { AppShell } from "@/components/layout/app-shell";
import { FreshSiteOnboardingFlow } from "@/modules/foundation/FreshSiteOnboardingFlow";

export default function NewSitePage() {
  return (
    <AppShell>
      <section>
        <FreshSiteOnboardingFlow />
      </section>
    </AppShell>
  );
}

