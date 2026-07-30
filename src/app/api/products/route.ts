import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { recordProductActivity } from "@/modules/foundation/product-audit";
import { createProduct, listProducts } from "@/modules/foundation/product-repository";
import { filterProducts } from "@/modules/foundation/product-selectors";
import type { NewProductInput } from "@/modules/foundation/types";

export async function GET(request: NextRequest) {
  const auth = authorizeRequest(request, "products:read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const products = filterProducts(listProducts(), {
    organizationId: scope.organizationId ?? undefined,
    siteId: scope.siteId ?? undefined,
    query: request.nextUrl.searchParams.get("query") ?? undefined,
  });

  return NextResponse.json({ products });
}

export async function POST(request: NextRequest) {
  const auth = authorizeRequest(request, "products:create");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as NewProductInput;
  const result = createProduct(body);

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.product) {
    return NextResponse.json({ error: "Unable to create product." }, { status: 400 });
  }

  recordProductActivity({
    productId: result.product.productId,
    organizationId: result.product.organizationId,
    type: "product_created",
    actor: "api",
    summary: "Product created through bounded product foundation API.",
  });

  return NextResponse.json({ product: result.product }, { status: 201 });
}
