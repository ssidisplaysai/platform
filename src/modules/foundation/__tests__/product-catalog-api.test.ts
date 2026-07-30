import { NextRequest } from "next/server";
import { GET as getProducts, POST as postProducts } from "@/app/api/products/route";
import { GET as getProductById, PATCH as patchProduct } from "@/app/api/products/[productId]/route";
import { GET as getProductReadiness } from "@/app/api/products/[productId]/readiness/route";
import { GET as getCategories, POST as postCategories } from "@/app/api/categories/route";
import { GET as getManufacturers, POST as postManufacturers } from "@/app/api/manufacturers/route";

function jsonRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, init);
}

describe("GCP-0002D product API authorization and behavior", () => {
  test("GET /api/products returns fixtures", async () => {
    const response = await getProducts();
    expect(response.status).toBe(200);

    const payload = (await response.json()) as { products: readonly unknown[] };
    expect(payload.products.length).toBeGreaterThan(0);
  });

  test("POST /api/products rejects viewer", async () => {
    const response = await postProducts(
      jsonRequest("http://localhost/api/products", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-gcp-roles": "viewer",
        },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(403);
  });

  test("POST /api/products accepts ops_manager with valid payload", async () => {
    const response = await postProducts(
      jsonRequest("http://localhost/api/products", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-gcp-roles": "ops_manager",
        },
        body: JSON.stringify({
          organizationId: "led-display-warehouse",
          productName: "API Created Product",
          displayName: "API Created Product",
          slug: "api-created-product",
          sku: "LEDW-API-NEW-001",
          modelNumber: null,
          shortDescription: "Short",
          fullDescription: "Full",
          productType: "led_display",
          productFamily: "api",
          categoryIds: ["cat-led-displays"],
          manufacturerId: "mfr-ledw-internal",
          brandReference: null,
          primarySiteId: "site-led-display-warehouse-production",
          assignedSiteIds: ["site-led-display-warehouse-production"],
          siteAssignments: [
            {
              siteId: "site-led-display-warehouse-production",
              enabledForSite: true,
              siteSpecificSlug: "api-created-product",
              siteSpecificDisplayName: "API Created Product",
              siteSpecificShortDescription: "Short",
              visibility: "internal",
              featured: false,
              sortOrder: 1,
              categoryIds: ["cat-led-displays"],
              defaultContentType: "article",
              publicationStatus: "not_ready",
              seoProfileReference: null,
              promptProfileReference: null,
              imageProfileReference: null,
              pricingDisplayMode: "request_quote",
              lastReadinessEvaluation: null,
              lastPublicationReference: null,
            },
          ],
          media: {
            primaryImageReference: null,
            galleryImageReferences: [],
            videoReferences: [],
          },
          documents: {
            technicalDrawingReferences: [],
            specSheetReferences: [],
            brochureReferences: [],
            manualReferences: [],
            installationGuideReferences: [],
            warrantyDocumentReferences: [],
          },
          specifications: [],
          seoProfileReference: null,
          promptProfileReference: null,
          businessGenomeObjectReference: null,
          sourceEvidenceReference: null,
          notes: null,
        }),
      }),
    );

    expect(response.status).toBe(201);
    const payload = (await response.json()) as { product: { productId: string } };
    expect(payload.product.productId).toContain("prod-led-display-warehouse-api-created-product");
  });

  test("PATCH /api/products/[productId] rejects viewer", async () => {
    const response = await patchProduct(
      jsonRequest("http://localhost/api/products/prod-indoor-led-video-wall", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-gcp-roles": "viewer",
        },
        body: JSON.stringify({ displayName: "blocked" }),
      }),
      {
        params: Promise.resolve({ productId: "prod-indoor-led-video-wall" }),
      },
    );

    expect(response.status).toBe(403);
  });

  test("GET /api/products/[productId] returns product", async () => {
    const response = await getProductById(
      jsonRequest("http://localhost/api/products/prod-indoor-led-video-wall"),
      {
        params: Promise.resolve({ productId: "prod-indoor-led-video-wall" }),
      },
    );

    expect(response.status).toBe(200);
  });

  test("GET /api/products/[productId]/readiness rejects viewer and allows analyst", async () => {
    const forbiddenResponse = await getProductReadiness(
      jsonRequest("http://localhost/api/products/prod-indoor-led-video-wall/readiness", {
        headers: {
          "x-gcp-roles": "viewer",
        },
      }),
      {
        params: Promise.resolve({ productId: "prod-indoor-led-video-wall" }),
      },
    );

    expect(forbiddenResponse.status).toBe(403);

    const analystResponse = await getProductReadiness(
      jsonRequest("http://localhost/api/products/prod-indoor-led-video-wall/readiness", {
        headers: {
          "x-gcp-roles": "analyst",
        },
      }),
      {
        params: Promise.resolve({ productId: "prod-indoor-led-video-wall" }),
      },
    );

    expect(analystResponse.status).toBe(200);
  });

  test("category and manufacturer GET routes respond and POST enforces auth", async () => {
    const categoryRead = await getCategories();
    const manufacturerRead = await getManufacturers();

    expect(categoryRead.status).toBe(200);
    expect(manufacturerRead.status).toBe(200);

    const categoryWriteDenied = await postCategories(
      jsonRequest("http://localhost/api/categories", {
        method: "POST",
        headers: {
          "x-gcp-roles": "viewer",
        },
      }),
    );

    expect(categoryWriteDenied.status).toBe(403);

    const manufacturerWriteDenied = await postManufacturers(
      jsonRequest("http://localhost/api/manufacturers", {
        method: "POST",
        headers: {
          "x-gcp-roles": "viewer",
        },
      }),
    );

    expect(manufacturerWriteDenied.status).toBe(403);
  });
});
