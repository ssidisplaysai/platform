import { handleManufacturingDashboard } from "@/lib/gba/manufacturing-api";

export async function GET(request: Request) {
  return handleManufacturingDashboard(request);
}
