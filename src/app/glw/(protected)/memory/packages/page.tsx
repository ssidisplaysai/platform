import { GeaMemoryWorkspace } from "@/components/gea/gea-memory-workspace";
import { resolveGeaMemoryPermissions } from "../access";

export default async function MemoryPackagesPage() {
  const permissions = await resolveGeaMemoryPermissions("/glw/memory/packages");
  return <GeaMemoryWorkspace mode="packages" permissions={permissions} />;
}
