import { GeaMemoryWorkspace } from "@/components/gea/gea-memory-workspace";
import { resolveGeaMemoryPermissions } from "./access";

export default async function MemoryRegistryPage() {
  const permissions = await resolveGeaMemoryPermissions("/glw/memory");
  return <GeaMemoryWorkspace mode="registry" permissions={permissions} />;
}
