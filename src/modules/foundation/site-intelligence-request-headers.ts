import { operatorMutationHeaders } from "./operator-session-client";

type SiteIntelligenceHeaderOptions = {
  organizationId: string;
  siteId: string;
  mutation?: boolean;
  jsonContentType?: boolean;
};

export function siteIntelligenceRequestHeaders(
  input: SiteIntelligenceHeaderOptions,
): HeadersInit {
  const baseHeaders: Record<string, string> = {
    "x-gcp-roles": "ops_manager",
    "x-gcp-organization-id": input.organizationId,
    "x-gcp-site-id": input.siteId,
    ...(input.jsonContentType === false ? {} : { "Content-Type": "application/json" }),
  };

  return input.mutation ? operatorMutationHeaders(baseHeaders) : baseHeaders;
}

