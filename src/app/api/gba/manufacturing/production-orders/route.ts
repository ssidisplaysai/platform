import { handleCreateManufacturingProductionOrder, handleManufacturingProductionOrders } from "@/lib/gba/manufacturing-api";

export async function GET(request: Request) {
  return handleManufacturingProductionOrders(request);
}

export async function POST(request: Request) {
  return handleCreateManufacturingProductionOrder(request);
}
