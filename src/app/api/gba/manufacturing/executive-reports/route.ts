import { handleManufacturingExecutiveReports } from "@/lib/gba/manufacturing-api";

export async function GET(request: Request) {
  return handleManufacturingExecutiveReports(request);
}
