import { NextRequest } from "next/server";
import { POST as createCustomerApi, GET as listCustomersApi } from "@/app/api/customers/route";
import { GET as getCustomerApi, PATCH as patchCustomerApi } from "@/app/api/customers/[customerId]/route";
import { GET as customerReadinessApi } from "@/app/api/customers/[customerId]/readiness/route";
import { GET as contactsApi, POST as createContactApi } from "@/app/api/customers/[customerId]/contacts/route";
import { PATCH as patchContactApi } from "@/app/api/customers/[customerId]/contacts/[contactId]/route";
import { GET as addressesApi, POST as createAddressApi } from "@/app/api/customers/[customerId]/addresses/route";
import { PATCH as patchAddressApi } from "@/app/api/customers/[customerId]/addresses/[addressId]/route";
import { GET as duplicatesApi } from "@/app/api/customers/[customerId]/duplicates/route";
import { resetCustomerActivityForTests } from "@/modules/foundation/customer-audit";
import { resetCustomerRepositoryForTests } from "@/modules/foundation/customer-repository";

function request(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, init);
}

describe("GCP-0002G customer API", () => {
  beforeEach(() => {
    resetCustomerRepositoryForTests();
    resetCustomerActivityForTests();
  });

  test("customer listing enforces read permission", async () => {
    const denied = await listCustomersApi(request("http://localhost/api/customers", {
      headers: { "x-gcp-roles": "viewer" },
    }));
    expect(denied.status).toBe(403);

    const allowed = await listCustomersApi(request("http://localhost/api/customers", {
      headers: { "x-gcp-roles": "ops_manager" },
    }));
    expect(allowed.status).toBe(200);
  });

  test("customer create and patch enforce authorization", async () => {
    const payload = {
      organizationId: "led-display-warehouse",
      accountName: "API Created Customer",
      legalName: null,
      accountCode: "LEDW-CUST-API-0001",
      accountType: "direct",
      lifecycleState: "active",
      enabled: true,
      primarySiteId: "site-led-display-warehouse-production",
      associatedSiteIds: ["site-led-display-warehouse-production"],
      communicationPreferences: {
        emailEnabled: true,
        smsEnabled: false,
        phoneEnabled: true,
        marketingOptIn: false,
        operationalAlertsEnabled: true,
        invoiceNoticesEnabled: true,
        preferredFrequency: "weekly",
        timezone: "America/Chicago",
      },
      taxExempt: false,
      tags: ["api"],
      notes: null,
    };

    const deniedCreate = await createCustomerApi(request("http://localhost/api/customers", {
      method: "POST",
      headers: { "x-gcp-roles": "viewer", "content-type": "application/json" },
      body: JSON.stringify(payload),
    }));
    expect(deniedCreate.status).toBe(403);

    const created = await createCustomerApi(request("http://localhost/api/customers", {
      method: "POST",
      headers: { "x-gcp-roles": "ops_manager", "content-type": "application/json" },
      body: JSON.stringify(payload),
    }));
    expect(created.status).toBe(201);

    const createdPayload = (await created.json()) as { customer: { customerId: string } };

    const deniedPatch = await patchCustomerApi(request(`http://localhost/api/customers/${createdPayload.customer.customerId}`, {
      method: "PATCH",
      headers: { "x-gcp-roles": "viewer", "content-type": "application/json" },
      body: JSON.stringify({ notes: "blocked" }),
    }), {
      params: Promise.resolve({ customerId: createdPayload.customer.customerId }),
    });
    expect(deniedPatch.status).toBe(403);

    const allowedPatch = await patchCustomerApi(request(`http://localhost/api/customers/${createdPayload.customer.customerId}`, {
      method: "PATCH",
      headers: { "x-gcp-roles": "ops_manager", "content-type": "application/json" },
      body: JSON.stringify({ notes: "allowed" }),
    }), {
      params: Promise.resolve({ customerId: createdPayload.customer.customerId }),
    });
    expect(allowedPatch.status).toBe(200);
  });

  test("nested contacts and addresses routes support read/write behavior", async () => {
    const contactsRead = await contactsApi(request("http://localhost/api/customers/cust-ledw-stadium-group/contacts", {
      headers: { "x-gcp-roles": "ops_manager" },
    }), {
      params: Promise.resolve({ customerId: "cust-ledw-stadium-group" }),
    });
    expect(contactsRead.status).toBe(200);

    const contactCreate = await createContactApi(request("http://localhost/api/customers/cust-ledw-stadium-group/contacts", {
      method: "POST",
      headers: { "x-gcp-roles": "ops_manager", "content-type": "application/json" },
      body: JSON.stringify({
        fullName: "API Contact",
        role: "operations",
        title: null,
        email: "api.contact@stadiumgroup.example",
        phone: null,
        preferredContact: false,
        decisionMaker: false,
        enabled: true,
        notes: null,
      }),
    }), {
      params: Promise.resolve({ customerId: "cust-ledw-stadium-group" }),
    });
    expect(contactCreate.status).toBe(201);

    const contactPayload = (await contactCreate.json()) as { contact: { contactId: string } };

    const contactPatch = await patchContactApi(request(`http://localhost/api/customers/cust-ledw-stadium-group/contacts/${contactPayload.contact.contactId}`, {
      method: "PATCH",
      headers: { "x-gcp-roles": "ops_manager", "content-type": "application/json" },
      body: JSON.stringify({ title: "Updated Title" }),
    }), {
      params: Promise.resolve({
        customerId: "cust-ledw-stadium-group",
        contactId: contactPayload.contact.contactId,
      }),
    });
    expect(contactPatch.status).toBe(200);

    const addressesRead = await addressesApi(request("http://localhost/api/customers/cust-ledw-stadium-group/addresses", {
      headers: { "x-gcp-roles": "ops_manager" },
    }), {
      params: Promise.resolve({ customerId: "cust-ledw-stadium-group" }),
    });
    expect(addressesRead.status).toBe(200);

    const addressCreate = await createAddressApi(request("http://localhost/api/customers/cust-ledw-stadium-group/addresses", {
      method: "POST",
      headers: { "x-gcp-roles": "ops_manager", "content-type": "application/json" },
      body: JSON.stringify({
        label: "API Address",
        addressType: "service",
        line1: "101 Service Dr",
        line2: null,
        city: "Chicago",
        region: "IL",
        postalCode: "60611",
        countryCode: "US",
        siteId: "site-led-display-warehouse-production",
        defaultBilling: false,
        defaultShipping: false,
        enabled: true,
        notes: null,
      }),
    }), {
      params: Promise.resolve({ customerId: "cust-ledw-stadium-group" }),
    });
    expect(addressCreate.status).toBe(201);

    const addressPayload = (await addressCreate.json()) as { address: { addressId: string } };

    const addressPatch = await patchAddressApi(request(`http://localhost/api/customers/cust-ledw-stadium-group/addresses/${addressPayload.address.addressId}`, {
      method: "PATCH",
      headers: { "x-gcp-roles": "ops_manager", "content-type": "application/json" },
      body: JSON.stringify({ notes: "Updated by API test" }),
    }), {
      params: Promise.resolve({
        customerId: "cust-ledw-stadium-group",
        addressId: addressPayload.address.addressId,
      }),
    });
    expect(addressPatch.status).toBe(200);
  });

  test("readiness and duplicate endpoints enforce expected roles", async () => {
    const readinessDenied = await customerReadinessApi(request("http://localhost/api/customers/cust-ledw-stadium-group/readiness", {
      headers: { "x-gcp-roles": "viewer" },
    }), {
      params: Promise.resolve({ customerId: "cust-ledw-stadium-group" }),
    });
    expect(readinessDenied.status).toBe(403);

    const readinessAllowed = await customerReadinessApi(request("http://localhost/api/customers/cust-ledw-stadium-group/readiness", {
      headers: { "x-gcp-roles": "analyst" },
    }), {
      params: Promise.resolve({ customerId: "cust-ledw-stadium-group" }),
    });
    expect(readinessAllowed.status).toBe(200);

    const duplicateDenied = await duplicatesApi(request("http://localhost/api/customers/cust-ledw-stadium-group/duplicates", {
      headers: { "x-gcp-roles": "viewer" },
    }), {
      params: Promise.resolve({ customerId: "cust-ledw-stadium-group" }),
    });
    expect(duplicateDenied.status).toBe(403);

    const duplicateAllowed = await duplicatesApi(request("http://localhost/api/customers/cust-ledw-stadium-group/duplicates", {
      headers: { "x-gcp-roles": "ops_manager" },
    }), {
      params: Promise.resolve({ customerId: "cust-ledw-stadium-group" }),
    });
    expect(duplicateAllowed.status).toBe(200);
  });

  test("detail route returns not found for missing id", async () => {
    const missing = await getCustomerApi(request("http://localhost/api/customers/customer-missing", {
      headers: { "x-gcp-roles": "ops_manager" },
    }), {
      params: Promise.resolve({ customerId: "customer-missing" }),
    });

    expect(missing.status).toBe(404);
  });
});
