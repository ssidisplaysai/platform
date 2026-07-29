import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { recordProductActivity } from "@/modules/foundation/product-audit";
import { getProductById, updateProduct } from "@/modules/foundation/product-repository";
import type { UpdateProductInput } from "@/modules/foundation/types";

type RouteContext = {
  params: Promise<{
    productId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "products:read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { productId } = await context.params;
  const product = getProductById(productId);

  if (
    !product ||
    !isRecordInScope({
      recordOrganizationId: product.organizationId,
      recordSiteId: product.primarySiteId,
      scope,
    })
  ) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  return NextResponse.json({ product });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "products:update");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { productId } = await context.params;
  const patch = (await request.json()) as UpdateProductInput;
  const result = updateProduct(productId, patch);

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  recordProductActivity({
    productId: result.product.productId,
    organizationId: result.product.organizationId,
    type: "product_updated",
    actor: "api",
    summary: "Product updated through bounded product foundation API.",
  });

  return NextResponse.json({ product: result.product });
}
