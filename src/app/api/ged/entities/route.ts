import { handleEnterpriseEntities } from "@/lib/ged/enterprise-domain-api";

export async function GET(request: Request) {
  return handleEnterpriseEntities(request);
}
