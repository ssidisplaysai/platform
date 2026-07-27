import { handleManufacturingQuality, handleRecordManufacturingQualityEvent } from "@/lib/gba/manufacturing-api";

export async function GET(request: Request) {
  return handleManufacturingQuality(request);
}

export async function POST(request: Request) {
  return handleRecordManufacturingQualityEvent(request);
}
