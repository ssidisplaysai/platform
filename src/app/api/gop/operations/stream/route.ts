import { handleOperationsStream } from "@/lib/gop/operations-api";

export async function GET(request: Request): Promise<Response> {
  return handleOperationsStream(request);
}
