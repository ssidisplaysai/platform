import { GbaCustomerSuccessWorkspace } from "@/components/gba/gba-customer-success-workspace";
import { resolveGbaCustomerSuccessPermissions } from "../access";

export default async function CustomerSuccessAgentSettingsPage() {
  const permissions = await resolveGbaCustomerSuccessPermissions("/glw/customer-success-agent/settings");
  return <GbaCustomerSuccessWorkspace mode="settings" permissions={permissions} />;
}
