import { handleEnterpriseEntity } from "@/lib/ged/enterprise-domain-api";

export async function GET(request: Request, context: { params: Promise<{ entityKey: string }> }) {
  const params = await context.params;
  const url = new URL(request.url);
  url.searchParams.set("entityKey", params.entityKey);
  return handleEnterpriseEntity(new Request(url.toString(), request));
}
