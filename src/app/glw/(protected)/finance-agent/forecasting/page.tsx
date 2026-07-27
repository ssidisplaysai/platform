import { GbaFinanceWorkspace } from "@/components/gba/gba-finance-workspace";
import { resolveGbaFinancePermissions } from "../access";

export default async function FinanceAgentForecastingPage() {
  const permissions = await resolveGbaFinancePermissions("/glw/finance-agent/forecasting");
  return <GbaFinanceWorkspace mode="forecasting" permissions={permissions} />;
}
