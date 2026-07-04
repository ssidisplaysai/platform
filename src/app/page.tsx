import { AppShell } from "@/components/layout/app-shell";
import { MissionControlPage } from "@/modules/mission-control/MissionControlPage";

export default function Home() {
  return (
    <AppShell>
      <MissionControlPage />
    </AppShell>
  );
}