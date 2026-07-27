import { GeaMemoryWorkspace } from "@/components/gea/gea-memory-workspace";
import { resolveGeaMemoryPermissions } from "../access";

export default async function MemoryReplayPage() {
  const permissions = await resolveGeaMemoryPermissions("/glw/memory/replay");
  return <GeaMemoryWorkspace mode="replay" permissions={permissions} />;
}
