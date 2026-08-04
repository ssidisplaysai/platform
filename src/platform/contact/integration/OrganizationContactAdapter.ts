import { getGenesisOrganizationRuntime } from "@/platform/organization";
import type { ContactPlatformDependencies, OrganizationId, TenantId } from "../contracts";

export class OrganizationContactAdapter {
  async organizationExists(input: { organizationId: OrganizationId; tenantId: TenantId }): Promise<boolean> {
    const runtime = await getGenesisOrganizationRuntime();
    const organization = runtime.registry.getOrganization(input.organizationId);
    if (!organization) {
      return false;
    }

    if (organization.tenantId && organization.tenantId !== input.tenantId) {
      return false;
    }

    return true;
  }
}

export function createOrganizationDependency(): ContactPlatformDependencies["organization"] {
  const adapter = new OrganizationContactAdapter();
  return {
    organizationExists: (input) => adapter.organizationExists(input),
  };
}
