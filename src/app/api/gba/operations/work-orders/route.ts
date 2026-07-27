import { handleCreateOperationsWorkOrder, handleOperationsWorkOrders } from "@/lib/gba/operations-api";

export async function GET(request: Request) {
  return handleOperationsWorkOrders(request);
}

export async function POST(request: Request) {
  return handleCreateOperationsWorkOrder(request);
}
