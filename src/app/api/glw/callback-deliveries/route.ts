import { handleGetGlwCallbackDeliveries, handlePostGlwCallbackDeliveries } from "@/lib/glw/callback-delivery-operations-api";

export async function GET(request: Request) {
  return handleGetGlwCallbackDeliveries(request);
}

export async function POST(request: Request) {
  return handlePostGlwCallbackDeliveries(request);
}
