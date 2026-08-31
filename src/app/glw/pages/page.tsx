import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";
export const revalidate = 0;
import { GlwPagesCenter } from "@/modules/glw/GlwPagesCenter";

type GlwPagesRouteProps = {
  searchParams: Promise<{
    organizationId?: string | string[];
    siteId?: string | string[];
  }>;
};

function firstSearchParam(
  value: string | string[] | undefined,
): string | null {
  if (typeof value === "string") {
    const normalized = value.trim();

    return normalized.length > 0
      ? normalized
      : null;
  }

  if (Array.isArray(value)) {
    const normalized = value[0]?.trim();

    return normalized && normalized.length > 0
      ? normalized
      : null;
  }

  return null;
}

export default async function GlwPagesRoute({
  searchParams,
}: GlwPagesRouteProps) {
  const params = await searchParams;

  return (
    <AppShell>
      <GlwPagesCenter
        requestedOrganizationId={firstSearchParam(
          params.organizationId,
        )}
        requestedSiteId={firstSearchParam(
          params.siteId,
        )}
      />
    </AppShell>
  );
}