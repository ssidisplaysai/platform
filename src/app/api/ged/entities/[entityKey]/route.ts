import { handleEnterpriseEntity } from "@/lib/ged/enterprise-domain-api";

export async function GET(request: Request, context: { params: { entityKey: string } }) {
  const url = new URL(request.url);
  url.searchParams.set("entityKey", context.params.entityKey);
  return handleEnterpriseEntity(new Request(url.toString(), request));
}
