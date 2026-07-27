import { handleEnterpriseVersions } from "@/lib/ged/enterprise-domain-api";

export async function GET(request: Request) {
  return handleEnterpriseVersions(request);
}
