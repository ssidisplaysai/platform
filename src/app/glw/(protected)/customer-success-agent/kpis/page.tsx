import { GbaCustomerSuccessWorkspace } from "@/components/gba/gba-customer-success-workspace";
import { resolveGbaCustomerSuccessPermissions } from "../access";

export default async function CustomerSuccessAgentKpisPage() {
  const permissions = await resolveGbaCustomerSuccessPermissions("/glw/customer-success-agent/kpis");
  return <GbaCustomerSuccessWorkspace mode="kpis" permissions={permissions} />;
}
