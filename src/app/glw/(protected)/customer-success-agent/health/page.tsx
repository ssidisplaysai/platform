import { GbaCustomerSuccessWorkspace } from "@/components/gba/gba-customer-success-workspace";
import { resolveGbaCustomerSuccessPermissions } from "../access";

export default async function CustomerSuccessAgentHealthPage() {
  const permissions = await resolveGbaCustomerSuccessPermissions("/glw/customer-success-agent/health");
  return <GbaCustomerSuccessWorkspace mode="health" permissions={permissions} />;
}
