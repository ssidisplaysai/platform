import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { listCategories, validateCategories } from "@/modules/foundation/product-repository";

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
  const auth = authorizeRequest(request, "products:manage_categories");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return NextResponse.json(
    {
      message: "Category writes are intentionally deferred in this bounded foundation release.",
    },
    { status: 501 },
  );
}
