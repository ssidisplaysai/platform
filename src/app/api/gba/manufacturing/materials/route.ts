import { handleManufacturingMaterials } from "@/lib/gba/manufacturing-api";

export async function GET(request: Request) {
  return handleManufacturingMaterials(request);
}
