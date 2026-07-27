import { handleManufacturingHealth } from "@/lib/gba/manufacturing-api";

export async function GET(request: Request) {
  return handleManufacturingHealth(request);
}
