import { GbaSalesWorkspace } from "@/components/gba/gba-sales-workspace";
import { resolveGbaSalesPermissions } from "../access";

export default async function SalesAgentForecastingPage() {
  const permissions = await resolveGbaSalesPermissions("/glw/sales-agent/forecasting");
  return <GbaSalesWorkspace mode="forecasting" permissions={permissions} />;
}
