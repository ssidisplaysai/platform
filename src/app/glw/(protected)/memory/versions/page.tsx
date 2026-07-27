import { GeaMemoryWorkspace } from "@/components/gea/gea-memory-workspace";
import { resolveGeaMemoryPermissions } from "../access";

export default async function MemoryVersionsPage() {
  const permissions = await resolveGeaMemoryPermissions("/glw/memory/versions");
  return <GeaMemoryWorkspace mode="versions" permissions={permissions} />;
}
