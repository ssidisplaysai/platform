import { ExecutiveBriefing } from "./ExecutiveBriefing";
import { CompanyHealth } from "./CompanyHealth";
import { PriorityTasks } from "./PriorityTasks";
import { AIRecommendations } from "./AIRecommendations";
import { RecentActivity } from "./RecentActivity";
import { QuickActions } from "./QuickActions";

export function MissionControlPage() {
  return (
    <div className="space-y-6">
      <ExecutiveBriefing />

      <CompanyHealth />

      <div className="grid gap-6 lg:grid-cols-2">
        <PriorityTasks />

        <AIRecommendations />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentActivity />

        <QuickActions />
      </div>
    </div>
  );
}