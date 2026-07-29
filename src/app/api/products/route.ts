import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/modules/foundation/api-auth";
import { recordProductActivity } from "@/modules/foundation/product-audit";
import { createProduct, listProducts } from "@/modules/foundation/product-repository";
import type { NewProductInput } from "@/modules/foundation/types";

export async function GET() {
  return NextResponse.json({ products: listProducts() });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request, "products:create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
