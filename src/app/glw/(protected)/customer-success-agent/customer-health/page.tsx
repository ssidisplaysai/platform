import { GbaCustomerSuccessWorkspace } from "@/components/gba/gba-customer-success-workspace";
import { resolveGbaCustomerSuccessPermissions } from "../access";

export default async function CustomerSuccessAgentCustomerHealthPage() {
  const permissions = await resolveGbaCustomerSuccessPermissions("/glw/customer-success-agent/customer-health");
  return <GbaCustomerSuccessWorkspace mode="customer-health" permissions={permissions} />;
}
