import { GbaCustomerSuccessWorkspace } from "@/components/gba/gba-customer-success-workspace";
import { resolveGbaCustomerSuccessPermissions } from "../access";

export default async function CustomerSuccessAgentReportsPage() {
  const permissions = await resolveGbaCustomerSuccessPermissions("/glw/customer-success-agent/reports");
  return <GbaCustomerSuccessWorkspace mode="reports" permissions={permissions} />;
}
