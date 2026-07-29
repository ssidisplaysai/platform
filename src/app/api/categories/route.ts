import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/modules/foundation/api-auth";
import { listCategories, validateCategories } from "@/modules/foundation/product-repository";

export async function GET() {
  const hierarchyValidation = validateCategories();
  return NextResponse.json({ categories: listCategories(), hierarchyValidation });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request, "products:manage_categories")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(
    {
      message: "Category writes are intentionally deferred in this bounded foundation release.",
    },
    { status: 501 },
  );
}
