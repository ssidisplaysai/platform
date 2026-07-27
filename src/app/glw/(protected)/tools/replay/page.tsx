import { GeaToolWorkspace } from "@/components/gea/gea-tool-workspace";
import { resolveGeaToolPermissions } from "../access";

export default async function ToolReplayPage() {
  const permissions = await resolveGeaToolPermissions("/glw/tools/replay");
  return <GeaToolWorkspace mode="replay" permissions={permissions} />;
}
