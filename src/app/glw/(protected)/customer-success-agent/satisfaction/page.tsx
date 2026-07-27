import { GbaCustomerSuccessWorkspace } from "@/components/gba/gba-customer-success-workspace";
import { resolveGbaCustomerSuccessPermissions } from "../access";

export default async function CustomerSuccessAgentSatisfactionPage() {
  const permissions = await resolveGbaCustomerSuccessPermissions("/glw/customer-success-agent/satisfaction");
  return <GbaCustomerSuccessWorkspace mode="satisfaction" permissions={permissions} />;
}
