import { NextRequest, NextResponse } from "next/server";
import {
  createOrganization,
  listOrganizations,
} from "@/modules/foundation/organization-repository";
import { authorizeRequest } from "@/modules/foundation/api-auth";

type CreateOrganizationRequest = {
  id: string;
  name: string;
  status: "active" | "planning";
  ownerAuthorization: string;
};

export async function GET(request: NextRequest) {
  const auth = authorizeRequest(request, "sites:read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const statusFilter = request.nextUrl.searchParams.get("status");
  const organizations = listOrganizations().filter((organization) =>
    statusFilter ? organization.status === statusFilter : true,
  );

  return NextResponse.json({ organizations });
}

export async function POST(request: NextRequest) {
  const auth = authorizeRequest(request, "settings:manage");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as CreateOrganizationRequest;
  if (body.ownerAuthorization !== "OWNER_AUTHORIZED_CREATE_ORGANIZATION") {
    return NextResponse.json({
      error: "Owner authorization acknowledgement is required.",
    }, { status: 403 });
  }

  const result = createOrganization({
    id: body.id,
    name: body.name,
    status: body.status,
  });

  if (result.issues.length > 0) {
    const duplicate = result.issues.some((issue) => issue.message.includes("already exists"));
    return NextResponse.json({ issues: result.issues }, { status: duplicate ? 409 : 400 });
  }

  return NextResponse.json({ organization: result.organization }, { status: 201 });
}
