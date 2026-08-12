import { MissionControlFoundation } from "@/components/gmc/mission-control-foundation";
import { getMissionControlService } from "@/platform/gmc";

export async function MissionControlPage() {
  const service = await getMissionControlService();
  const [workspace, filters] = await Promise.all([
    service.assembleWorkspace(),
    service.getFilters(),
  ]);

  return (
    <MissionControlFoundation workspace={workspace} filters={filters} />
  );
}