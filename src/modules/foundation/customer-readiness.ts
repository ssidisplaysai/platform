import type {
  CustomerAddressRecord,
  CustomerConfiguration,
  CustomerContactRecord,
  CustomerReadinessCondition,
  CustomerReadinessResult,
  PermissionAction,
} from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

function lifecyclePermits(customer: CustomerConfiguration): boolean {
  return customer.lifecycleState === "active" || customer.lifecycleState === "prospect";
}

function hasReachableContact(contacts: readonly CustomerContactRecord[]): boolean {
  return contacts.some(
    (contact) =>
      contact.enabled &&
      Boolean(
        (contact.email && contact.email.trim().length > 0) ||
        (contact.phone && contact.phone.trim().length > 0),
      ),
  );
}

export function evaluateCustomerReadiness(input: {
  customer: CustomerConfiguration;
  contacts: readonly CustomerContactRecord[];
  addresses: readonly CustomerAddressRecord[];
  requiredPermission: PermissionAction;
  permissions: Set<PermissionAction>;
}): CustomerReadinessResult {
  const { customer, contacts, addresses, requiredPermission, permissions } = input;

  const billingAddress = customer.billingAddressId
    ? addresses.find((address) => address.addressId === customer.billingAddressId)
    : null;

  const shippingAddress = customer.shippingAddressId
    ? addresses.find((address) => address.addressId === customer.shippingAddressId)
    : null;

  const primaryContact = customer.primaryContactId
    ? contacts.find((contact) => contact.contactId === customer.primaryContactId)
    : null;

  const conditions: CustomerReadinessCondition[] = [
    {
      key: "customer_enabled",
      passed: customer.enabled,
      details: customer.enabled ? "Customer account is enabled." : "Customer account is disabled.",
    },
    {
      key: "lifecycle_permits_operation",
      passed: lifecyclePermits(customer),
      details: `Lifecycle state is ${customer.lifecycleState}.`,
    },
    {
      key: "primary_site_assigned",
      passed: Boolean(customer.primarySiteId),
      details: customer.primarySiteId
        ? `Primary site ${customer.primarySiteId} assigned.`
        : "Primary site assignment is missing.",
    },
    {
      key: "site_association_present",
      passed: customer.associatedSiteIds.length > 0,
      details: customer.associatedSiteIds.length > 0
        ? `${customer.associatedSiteIds.length} associated sites configured.`
        : "At least one associated site is required.",
    },
    {
      key: "primary_contact_present",
      passed: Boolean(primaryContact),
      details: primaryContact
        ? `Primary contact ${primaryContact.fullName} configured.`
        : "Primary contact is missing.",
    },
    {
      key: "contact_reachable",
      passed: hasReachableContact(contacts),
      details: hasReachableContact(contacts)
        ? "At least one reachable contact is configured."
        : "No reachable contact email or phone is configured.",
    },
    {
      key: "billing_address_present",
      passed: Boolean(billingAddress),
      details: billingAddress
        ? `Billing address ${billingAddress.label} configured.`
        : "Billing address is missing.",
    },
    {
      key: "shipping_address_present",
      passed: Boolean(shippingAddress),
      details: shippingAddress
        ? `Shipping address ${shippingAddress.label} configured.`
        : "Shipping address is missing.",
    },
    {
      key: "communication_preferences_defined",
      passed: Boolean(customer.communicationPreferences.preferredFrequency),
      details: `Preferred communication frequency is ${customer.communicationPreferences.preferredFrequency}.`,
    },
    {
      key: "user_has_permission",
      passed: permissions.has(requiredPermission),
      details: permissions.has(requiredPermission)
        ? `Permission ${requiredPermission} granted.`
        : `Permission ${requiredPermission} missing.`,
    },
  ];

  const blockingReasons = conditions
    .filter((condition) => !condition.passed)
    .map((condition) => condition.details);

  const warnings: string[] = [];
  if (customer.lifecycleState === "prospect") {
    warnings.push("Prospect lifecycle state may limit downstream commercial operations.");
  }

  const ready = blockingReasons.length === 0;

  return {
    customerId: customer.customerId,
    ready,
    status: ready ? "ready" : warnings.length > 0 ? "warning" : "blocked",
    blockingReasons,
    warnings,
    checkedConditions: conditions,
    checkedAt: nowIso(),
  };
}
