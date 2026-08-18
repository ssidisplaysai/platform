import { handleGetGlwReconciliation, handlePostGlwReconciliation } from "@/lib/glw/callback-delivery-reconciliation-api";

export async function GET(request: Request) {
  return handleGetGlwReconciliation(request);
}

export async function POST(request: Request) {
  return handlePostGlwReconciliation(request);
}
