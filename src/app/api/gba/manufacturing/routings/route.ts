import { handleManufacturingRoutings } from "@/lib/gba/manufacturing-api";

export async function GET(request: Request) {
  return handleManufacturingRoutings(request);
}
