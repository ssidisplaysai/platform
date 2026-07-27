import { handleManufacturingKpis } from "@/lib/gba/manufacturing-api";

export async function GET(request: Request) {
  return handleManufacturingKpis(request);
}
