import { handleManufacturingCosting } from "@/lib/gba/manufacturing-api";

export async function GET(request: Request) {
  return handleManufacturingCosting(request);
}
