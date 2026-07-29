import { resetCustomerActivityForTests } from "@/modules/foundation/customer-audit";
import {
  createCustomer,
  createCustomerAddress,
  createCustomerContact,
  detectCustomerDuplicates,
  evaluateCustomerReadinessById,
  listCustomerAddresses,
  listCustomerContacts,
  listCustomers,
  resetCustomerRepositoryForTests,
  updateCustomer,
  validateCustomerIntegrity,
} from "@/modules/foundation/customer-repository";

describe("GCP-0002G customer foundation", () => {
  beforeEach(() => {
    resetCustomerRepositoryForTests();
    resetCustomerActivityForTests();
  });

  test("fixture-backed customer registry includes seeded accounts", () => {
    const customers = listCustomers();
    expect(customers.length).toBeGreaterThan(0);
    expect(customers.some((customer) => customer.customerId === "cust-ledw-stadium-group")).toBe(true);
  });

  test("customer creation rejects secret-like payloads", () => {
    const result = createCustomer({
      organizationId: "led-display-warehouse",
      accountName: "Secret Account",
      legalName: null,
      accountCode: "LEDW-CUST-0099",
      accountType: "direct",
      lifecycleState: "active",
      enabled: true,
      primarySiteId: "site-led-display-warehouse-production",
      associatedSiteIds: ["site-led-display-warehouse-production"],
      communicationPreferences: {
        emailEnabled: true,
        smsEnabled: false,
        phoneEnabled: false,
        marketingOptIn: false,
        operationalAlertsEnabled: false,
        invoiceNoticesEnabled: true,
        preferredFrequency: "weekly",
        timezone: null,
      },
      taxExempt: false,
      tags: ["secret-token"],
      notes: "password=should-not-pass",
    });

    expect(result.validation.valid).toBe(false);
  });

  test("prospect account without contact/address is not ready", () => {
    const readiness = evaluateCustomerReadinessById({
      customerId: "cust-ledw-retail-pilot",
      requiredPermission: "customers:evaluate_readiness",
      permissions: new Set(["customers:evaluate_readiness"]),
    });

    expect(readiness).toBeDefined();
    expect(readiness?.ready).toBe(false);
    expect(readiness?.blockingReasons.some((reason) => reason.includes("Primary contact"))).toBe(true);
  });

  test("contact and address creation succeeds for valid payload", () => {
    const contactResult = createCustomerContact("cust-ledw-retail-pilot", {
      fullName: "Morgan Fields",
      role: "procurement",
      title: "Buyer",
      email: "morgan.fields@retailpilot.example",
      phone: "+1-312-555-1130",
      preferredContact: true,
      decisionMaker: true,
      enabled: true,
      notes: null,
    });

    expect(contactResult.validation.valid).toBe(true);
    expect(contactResult.contact).toBeTruthy();

    const addressResult = createCustomerAddress("cust-ledw-retail-pilot", {
      label: "Retail Pilot Billing",
      addressType: "billing",
      line1: "900 Market Street",
      line2: null,
      city: "Chicago",
      region: "IL",
      postalCode: "60610",
      countryCode: "US",
      siteId: "site-led-display-warehouse-production",
      defaultBilling: true,
      defaultShipping: true,
      enabled: true,
      notes: null,
    });

    expect(addressResult.validation.valid).toBe(true);
    expect(addressResult.address).toBeTruthy();

    expect(listCustomerContacts("cust-ledw-retail-pilot").length).toBe(1);
    expect(listCustomerAddresses("cust-ledw-retail-pilot").length).toBe(1);
  });

  test("duplicate detection flags shared contact email", () => {
    const created = createCustomer({
      organizationId: "led-display-warehouse",
      accountName: "Stadium Growth Group West",
      legalName: null,
      accountCode: "LEDW-CUST-0103",
      accountType: "dealer",
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
      tags: [],
      notes: null,
    });

    expect(created.customer).toBeTruthy();

    const createdId = created.customer?.customerId as string;
    const contactResult = createCustomerContact(createdId, {
      fullName: "Shared Contact",
      role: "finance",
      title: null,
      email: "amy.richardson@stadiumgroup.example",
      phone: null,
      preferredContact: true,
      decisionMaker: false,
      enabled: true,
      notes: null,
    });

    expect(contactResult.validation.valid).toBe(true);

    const duplicates = detectCustomerDuplicates("cust-ledw-stadium-group");
    expect(duplicates.some((candidate) => candidate.matchedCustomerId === createdId)).toBe(true);
  });

  test("customer update and link integrity validation remain valid", () => {
    const updated = updateCustomer("cust-ledw-stadium-group", {
      notes: "Updated notes",
      tags: ["enterprise", "renewal"],
    });

    expect(updated.validation.valid).toBe(true);

    const integrity = validateCustomerIntegrity("cust-ledw-stadium-group");
    expect(integrity.valid).toBe(true);
  });
});
