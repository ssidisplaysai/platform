import { GbaCustomerSuccessWorkspace } from "@/components/gba/gba-customer-success-workspace";
import { resolveGbaCustomerSuccessPermissions } from "../access";

export default async function CustomerSuccessAgentSuccessPlansPage() {
  const permissions = await resolveGbaCustomerSuccessPermissions("/glw/customer-success-agent/success-plans");
  return <GbaCustomerSuccessWorkspace mode="success-plans" permissions={permissions} />;
}
