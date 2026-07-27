import { handleManufacturingTimeline } from "@/lib/gba/manufacturing-api";

export async function GET(request: Request) {
  return handleManufacturingTimeline(request);
}
