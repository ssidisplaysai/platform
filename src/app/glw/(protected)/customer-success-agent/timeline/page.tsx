import { GbaCustomerSuccessWorkspace } from "@/components/gba/gba-customer-success-workspace";
import { resolveGbaCustomerSuccessPermissions } from "../access";

export default async function CustomerSuccessAgentTimelinePage() {
  const permissions = await resolveGbaCustomerSuccessPermissions("/glw/customer-success-agent/timeline");
  return <GbaCustomerSuccessWorkspace mode="timeline" permissions={permissions} />;
}
