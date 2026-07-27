import { GbaCustomerSuccessWorkspace } from "@/components/gba/gba-customer-success-workspace";
import { resolveGbaCustomerSuccessPermissions } from "../access";

export default async function CustomerSuccessAgentRenewalsPage() {
  const permissions = await resolveGbaCustomerSuccessPermissions("/glw/customer-success-agent/renewals");
  return <GbaCustomerSuccessWorkspace mode="renewals" permissions={permissions} />;
}
