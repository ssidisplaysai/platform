import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  createCategory,
  listCategories,
  validateCategories,
} from "@/modules/foundation/product-repository";

export async function GET(request: NextRequest) {
  const auth = authorizeRequest(request, "products:read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const hierarchyValidation = validateCategories();
  return NextResponse.json({ categories: listCategories(), hierarchyValidation });
}

export async function POST(request: NextRequest) {
  const auth = authorizeRequest(
    request,
    "products:manage_categories",
  );

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status },
    );
  }

  const scope = resolveRequestScope(request);

  if (!hasOrganizationScope(scope)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 },
    );
  }

  const body = await request.json() as {
    name?: string;
    slug?: string;
    description?: string | null;
    parentCategoryId?: string | null;
    sortOrder?: number;
    siteAssignments?: string[];
  };

  const siteAssignments = Array.isArray(body.siteAssignments)
    ? body.siteAssignments
    : [];

  if (
    scope.siteId &&
    siteAssignments.some(
      (siteId) => siteId !== scope.siteId,
    )
  ) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 },
    );
  }

  const result = createCategory({
    organizationId: scope.organizationId,
    name: body.name ?? "",
    slug: body.slug ?? "",
    description: body.description ?? null,
    parentCategoryId: body.parentCategoryId ?? null,
    sortOrder: body.sortOrder ?? 0,
    siteAssignments,
  });

  if (!result.validation.valid || !result.category) {
    return NextResponse.json(
      {
        validation: result.validation,
      },
      {
        status: 400,
      },
    );
  }

  return NextResponse.json(
    {
      category: result.category,
    },
    {
      status: 201,
    },
  );
}
