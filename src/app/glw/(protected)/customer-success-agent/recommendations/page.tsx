import { GbaCustomerSuccessWorkspace } from "@/components/gba/gba-customer-success-workspace";
import { resolveGbaCustomerSuccessPermissions } from "../access";

export default async function CustomerSuccessAgentRecommendationsPage() {
  const permissions = await resolveGbaCustomerSuccessPermissions("/glw/customer-success-agent/recommendations");
  return <GbaCustomerSuccessWorkspace mode="recommendations" permissions={permissions} />;
}
