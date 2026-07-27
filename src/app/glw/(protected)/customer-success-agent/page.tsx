import { GbaCustomerSuccessWorkspace } from "@/components/gba/gba-customer-success-workspace";
import { resolveGbaCustomerSuccessPermissions } from "./access";

export default async function CustomerSuccessAgentDashboardPage() {
  const permissions = await resolveGbaCustomerSuccessPermissions("/glw/customer-success-agent");
  return <GbaCustomerSuccessWorkspace mode="dashboard" permissions={permissions} />;
}
