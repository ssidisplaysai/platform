import { GbaCustomerSuccessWorkspace } from "@/components/gba/gba-customer-success-workspace";
import { resolveGbaCustomerSuccessPermissions } from "../access";

export default async function CustomerSuccessAgentOnboardingPage() {
  const permissions = await resolveGbaCustomerSuccessPermissions("/glw/customer-success-agent/onboarding");
  return <GbaCustomerSuccessWorkspace mode="onboarding" permissions={permissions} />;
}
