import { NextRequest, NextResponse } from "next/server";
import { CompanyRepository } from "@/core/repositories/CompanyRepository";
import { authorizeRequest, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { resolvePermissions } from "@/modules/foundation/permissions";
import { listProducts } from "@/modules/foundation/product-repository";
import { listSites } from "@/modules/foundation/site-repository";
import { readGlwCampaignAuthoritySnapshot } from "@/modules/glw/campaign-authority";
import {
  buildGlwCampaignLaunchpadPreflight,
  createGlwLaunchpadGenerationForm,
  validateGlwCampaignLaunchpadInput,
  type GlwCampaignLaunchpadInput,
  type GlwCampaignReach,
} from "@/modules/glw/campaign-launchpad";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";
import { adaptProductForGeneration, adaptSiteForGeneration } from "@/modules/glw/page-generation";
import { readGlwTargetPreflight, type GlwTargetPreflightResult } from "@/modules/glw/target-preflight";

const REACH_VALUES: readonly GlwCampaignReach[] = [
  "NATIONWIDE", "STATE", "MULTI_STATE_REGION", "METRO_LOCAL", "CUSTOM",
];

export function parseGlwCampaignLaunchpadRequest(value: unknown): {
  input: GlwCampaignLaunchpadInput | null;
  error: string | null;
} {
  if (!value || typeof value !== "object") return { input: null, error: "A campaign preflight request is required." };
  const body = value as Record<string, unknown>;
  if (typeof body.reach !== "string" || !REACH_VALUES.includes(body.reach as GlwCampaignReach)) {
    return { input: null, error: "Select a supported desired reach." };
  }
  const input: GlwCampaignLaunchpadInput = {
    reach: body.reach as GlwCampaignReach,
    productUrl: typeof body.productUrl === "string" ? body.productUrl.trim() : "",
    stateCodes: Array.isArray(body.stateCodes) && body.stateCodes.every((item) => typeof item === "string")
      ? body.stateCodes
      : undefined,
    metro: typeof body.metro === "string" ? body.metro : undefined,
  };
  const validation = validateGlwCampaignLaunchpadInput(input);
  return validation.valid
    ? { input, error: null }
    : { input: null, error: validation.issues[0]?.message ?? "Campaign preflight request is invalid." };
}

export async function POST(request: NextRequest) {
  const auth = authorizeRequest(request, "sites:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = parseGlwCampaignLaunchpadRequest(body);
  if (!parsed.input) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const sites = listSites();
  const products = listProducts();
  const localExecutions = await glwPageExecutionRepository.list();
  const campaignSnapshot = readGlwCampaignAuthoritySnapshot();
  try {
    const preflight = await buildGlwCampaignLaunchpadPreflight({
      request: parsed.input,
      organizationId: scope.organizationId,
      organizationActive: CompanyRepository.getById(scope.organizationId)?.status === "active",
      permissions: resolvePermissions(auth.roles),
      sites,
      products,
      executionAuthority: { status: "CHECKED", records: localExecutions },
      campaignSnapshot,
      readTarget: async (target, site, product): Promise<GlwTargetPreflightResult> => {
        try {
          const requestInput = createGlwLaunchpadGenerationForm(
            target,
            adaptSiteForGeneration(site),
            adaptProductForGeneration(product, site.siteId),
          );
          return await readGlwTargetPreflight({
            request: {
              ...requestInput,
              organizationId: site.organizationId,
              siteName: site.displayName,
              productTopic: product.productName,
              stateName: target.stateName,
              cityName: target.cityName,
              canonicalPath: target.canonicalPath,
              plannedOperation: "CREATE_CITY",
              wordpressObjectId: null,
              externalExecutionAllowed: false,
            },
            wordpressApiBaseUrl: site.integrations.wordpressApiBaseUrl,
            localExecutions,
          });
        } catch {
          return {
            applicationPath: target.canonicalPath,
            canonicalPath: target.canonicalPath,
            canonicalProduct: product.displayName,
            canonicalProductSlug: product.slug,
            canonicalSlug: target.citySlug,
            canonicalParentId: null,
            state: "UNKNOWN",
            wordpressObjectId: null,
            wordpressStatus: null,
            wordpressTitle: null,
            wordpressUrl: null,
            source: "UNVERIFIED",
            confidence: "UNVERIFIED",
          };
        }
      },
    });
    return NextResponse.json({ preflight });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Campaign analysis failed." }, { status: 422 });
  }
}