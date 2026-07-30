import {
  FOUNDATION_CUSTOMER_ADDRESSES,
  FOUNDATION_CUSTOMER_CONTACTS,
  FOUNDATION_CUSTOMERS,
} from "./customer-fixtures";
import {
  deepClone,
  loadPersistedState,
  resetPersistedState,
  savePersistedState,
} from "./foundation-persistence";
import { evaluateCustomerReadiness } from "./customer-readiness";
import {
  validateCustomerReadinessLinks,
  validateNewCustomerAddressInput,
  validateNewCustomerContactInput,
  validateNewCustomerInput,
  validateUpdateCustomerAddressInput,
  validateUpdateCustomerContactInput,
  validateUpdateCustomerInput,
} from "./customer-validation";
import type {
  CustomerAddressRecord,
  CustomerConfiguration,
  CustomerContactRecord,
  CustomerDuplicateCandidate,
  CustomerListFilters,
  CustomerReadinessResult,
  CustomerValidationResult,
  NewCustomerAddressInput,
  NewCustomerContactInput,
  NewCustomerInput,
  PermissionAction,
  UpdateCustomerAddressInput,
  UpdateCustomerContactInput,
  UpdateCustomerInput,
} from "./types";

const PERSISTENCE_NAMESPACE = "customer-repository";

type CustomerRepositoryState = {
  customers: CustomerConfiguration[];
  contacts: CustomerContactRecord[];
  addresses: CustomerAddressRecord[];
};

const customerStore = new Map<string, CustomerConfiguration>();
const contactStore = new Map<string, CustomerContactRecord>();
const addressStore = new Map<string, CustomerAddressRecord>();

function createSeedState(): CustomerRepositoryState {
  return {
    customers: FOUNDATION_CUSTOMERS.map((customer) => ({
      ...deepClone(customer),
      associatedSiteIds: [...customer.associatedSiteIds],
      communicationPreferences: { ...customer.communicationPreferences },
      tags: [...customer.tags],
    })),
    contacts: FOUNDATION_CUSTOMER_CONTACTS.map((contact) => deepClone(contact)),
    addresses: FOUNDATION_CUSTOMER_ADDRESSES.map((address) => deepClone(address)),
  };
}

function applyState(state: CustomerRepositoryState): void {
  customerStore.clear();
  state.customers.forEach((customer) => {
    customerStore.set(customer.customerId, {
      ...deepClone(customer),
      associatedSiteIds: [...customer.associatedSiteIds],
      communicationPreferences: { ...customer.communicationPreferences },
      tags: [...customer.tags],
    });
  });

  contactStore.clear();
  state.contacts.forEach((contact) => {
    contactStore.set(contact.contactId, deepClone(contact));
  });

  addressStore.clear();
  state.addresses.forEach((address) => {
    addressStore.set(address.addressId, deepClone(address));
  });
}

function snapshotState(): CustomerRepositoryState {
  return {
    customers: Array.from(customerStore.values()).map((customer) => ({
      ...deepClone(customer),
      associatedSiteIds: [...customer.associatedSiteIds],
      communicationPreferences: { ...customer.communicationPreferences },
      tags: [...customer.tags],
    })),
    contacts: Array.from(contactStore.values()).map((contact) => deepClone(contact)),
    addresses: Array.from(addressStore.values()).map((address) => deepClone(address)),
  };
}

let stateRevision = 0;

function loadStateFromPersistence(): void {
  const loaded = loadPersistedState<CustomerRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: createSeedState,
  });

  applyState(loaded.state);
  stateRevision = loaded.revision;
}

function persistCurrentState(): void {
  const saved = savePersistedState<CustomerRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    state: snapshotState(),
    expectedRevision: stateRevision,
  });

  stateRevision = saved.revision;
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function createCustomerId(organizationId: string, accountName: string): string {
  const normalized = accountName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
  return `cust-${organizationId}-${normalized}`;
}

function createContactId(customerId: string, fullName: string): string {
  const normalized = fullName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return `contact-${customerId}-${normalized}`;
}

function createAddressId(customerId: string, label: string): string {
  const normalized = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return `addr-${customerId}-${normalized}`;
}

loadStateFromPersistence();

function hasDuplicateAccountCode(
  organizationId: string,
  accountCode: string,
  excludingCustomerId?: string,
): boolean {
  const normalizedCode = normalizeToken(accountCode);
  return Array.from(customerStore.values()).some(
    (customer) =>
      customer.organizationId === organizationId &&
      normalizeToken(customer.accountCode) === normalizedCode &&
      customer.customerId !== excludingCustomerId,
  );
}

function hasDuplicateAccountName(
  organizationId: string,
  accountName: string,
  excludingCustomerId?: string,
): boolean {
  const normalizedName = normalizeToken(accountName);
  return Array.from(customerStore.values()).some(
    (customer) =>
      customer.organizationId === organizationId &&
      normalizeToken(customer.accountName) === normalizedName &&
      customer.customerId !== excludingCustomerId,
  );
}

function customerMatchesFilters(
  customer: CustomerConfiguration,
  filters: CustomerListFilters,
): boolean {
  if (filters.organizationId && customer.organizationId !== filters.organizationId) {
    return false;
  }

  if (filters.lifecycleState && customer.lifecycleState !== filters.lifecycleState) {
    return false;
  }

  if (filters.accountType && customer.accountType !== filters.accountType) {
    return false;
  }

  if (filters.enabled !== undefined && customer.enabled !== filters.enabled) {
    return false;
  }

  if (filters.siteId) {
    const inPrimarySite = customer.primarySiteId === filters.siteId;
    const inAssociatedSites = customer.associatedSiteIds.includes(filters.siteId);
    if (!inPrimarySite && !inAssociatedSites) {
      return false;
    }
  }

  if (filters.query) {
    const query = filters.query.toLowerCase();
    const contactText = listCustomerContacts(customer.customerId)
      .map((contact) => `${contact.fullName} ${contact.email ?? ""}`)
      .join(" ");
    const candidate = [
      customer.accountName,
      customer.legalName ?? "",
      customer.accountCode,
      customer.customerId,
      customer.accountType,
      ...customer.tags,
      contactText,
    ]
      .join(" ")
      .toLowerCase();

    if (!candidate.includes(query)) {
      return false;
    }
  }

  return true;
}

function setPrimaryContactIfUnset(customerId: string, contactId: string): void {
  const customer = customerStore.get(customerId);
  if (!customer || customer.primaryContactId) {
    return;
  }

  customerStore.set(customerId, {
    ...customer,
    primaryContactId: contactId,
    updatedAt: nowIso(),
  });
}

function synchronizeAddressDefaults(customerId: string): void {
  const addresses = listCustomerAddresses(customerId);
  const defaultBilling = addresses.find((address) => address.defaultBilling);
  const defaultShipping = addresses.find((address) => address.defaultShipping);
  const customer = customerStore.get(customerId);

  if (!customer) {
    return;
  }

  customerStore.set(customerId, {
    ...customer,
    billingAddressId: defaultBilling?.addressId ?? customer.billingAddressId,
    shippingAddressId: defaultShipping?.addressId ?? customer.shippingAddressId,
    updatedAt: nowIso(),
  });
}

export function listCustomers(filters: CustomerListFilters = {}): readonly CustomerConfiguration[] {
  return Array.from(customerStore.values()).filter((customer) => customerMatchesFilters(customer, filters));
}

export function getCustomerById(customerId: string): CustomerConfiguration | null {
  return customerStore.get(customerId) ?? null;
}

export function createCustomer(input: NewCustomerInput): {
  validation: CustomerValidationResult;
  customer: CustomerConfiguration | null;
} {
  const validation = validateNewCustomerInput(input);
  if (!validation.valid) {
    return { validation, customer: null };
  }

  if (hasDuplicateAccountCode(input.organizationId, input.accountCode)) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "accountCode", message: "Account code already exists." }],
      },
      customer: null,
    };
  }

  if (hasDuplicateAccountName(input.organizationId, input.accountName)) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "accountName", message: "Account name already exists." }],
      },
      customer: null,
    };
  }

  const customerId = createCustomerId(input.organizationId, input.accountName);
  if (customerStore.has(customerId)) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "customerId", message: "Customer ID collision detected." }],
      },
      customer: null,
    };
  }

  const timestamp = nowIso();
  const customer: CustomerConfiguration = {
    ...input,
    customerId,
    primaryContactId: null,
    billingAddressId: null,
    shippingAddressId: null,
    associatedSiteIds: [...input.associatedSiteIds],
    communicationPreferences: { ...input.communicationPreferences },
    tags: [...input.tags],
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  customerStore.set(customerId, customer);
  persistCurrentState();
  return { validation, customer };
}

export function updateCustomer(
  customerId: string,
  patch: UpdateCustomerInput,
): {
  validation: CustomerValidationResult;
  customer: CustomerConfiguration | null;
} {
  const existing = customerStore.get(customerId);
  if (!existing) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "customerId", message: "Customer not found." }],
      },
      customer: null,
    };
  }

  const validation = validateUpdateCustomerInput(existing, patch);
  if (!validation.valid) {
    return { validation, customer: null };
  }

  if (
    patch.accountCode &&
    hasDuplicateAccountCode(existing.organizationId, patch.accountCode, existing.customerId)
  ) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "accountCode", message: "Account code already exists." }],
      },
      customer: null,
    };
  }

  if (
    patch.accountName &&
    hasDuplicateAccountName(existing.organizationId, patch.accountName, existing.customerId)
  ) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "accountName", message: "Account name already exists." }],
      },
      customer: null,
    };
  }

  const updated: CustomerConfiguration = {
    ...existing,
    ...patch,
    associatedSiteIds: patch.associatedSiteIds ? [...patch.associatedSiteIds] : [...existing.associatedSiteIds],
    communicationPreferences: {
      ...existing.communicationPreferences,
      ...(patch.communicationPreferences ?? {}),
    },
    tags: patch.tags ? [...patch.tags] : [...existing.tags],
    updatedAt: nowIso(),
  };

  customerStore.set(customerId, updated);
  persistCurrentState();
  return { validation, customer: updated };
}

export function listCustomerContacts(customerId: string): readonly CustomerContactRecord[] {
  return Array.from(contactStore.values()).filter((contact) => contact.customerId === customerId);
}

export function createCustomerContact(
  customerId: string,
  input: NewCustomerContactInput,
): {
  validation: CustomerValidationResult;
  contact: CustomerContactRecord | null;
} {
  const customer = customerStore.get(customerId);
  if (!customer) {
    return {
      validation: { valid: false, issues: [{ field: "customerId", message: "Customer not found." }] },
      contact: null,
    };
  }

  const validation = validateNewCustomerContactInput(input);
  if (!validation.valid) {
    return { validation, contact: null };
  }

  const contactId = createContactId(customerId, input.fullName);
  const existingById = contactStore.get(contactId);
  if (existingById) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "fullName", message: "A contact with this generated identity already exists." }],
      },
      contact: null,
    };
  }

  const timestamp = nowIso();
  const contact: CustomerContactRecord = {
    ...input,
    contactId,
    customerId,
    organizationId: customer.organizationId,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  if (contact.preferredContact) {
    listCustomerContacts(customerId).forEach((existingContact) => {
      contactStore.set(existingContact.contactId, {
        ...existingContact,
        preferredContact: false,
        updatedAt: timestamp,
      });
    });
  }

  contactStore.set(contactId, contact);
  setPrimaryContactIfUnset(customerId, contactId);
  persistCurrentState();

  return { validation, contact };
}

export function updateCustomerContact(
  customerId: string,
  contactId: string,
  patch: UpdateCustomerContactInput,
): {
  validation: CustomerValidationResult;
  contact: CustomerContactRecord | null;
} {
  const existing = contactStore.get(contactId);
  if (!existing || existing.customerId !== customerId) {
    return {
      validation: { valid: false, issues: [{ field: "contactId", message: "Contact not found." }] },
      contact: null,
    };
  }

  const validation = validateUpdateCustomerContactInput(patch);
  if (!validation.valid) {
    return { validation, contact: null };
  }

  const timestamp = nowIso();
  if (patch.preferredContact) {
    listCustomerContacts(customerId).forEach((entry) => {
      contactStore.set(entry.contactId, {
        ...entry,
        preferredContact: false,
        updatedAt: timestamp,
      });
    });
  }

  const updated: CustomerContactRecord = {
    ...existing,
    ...patch,
    updatedAt: timestamp,
  };

  contactStore.set(contactId, updated);
  persistCurrentState();
  return { validation, contact: updated };
}

export function listCustomerAddresses(customerId: string): readonly CustomerAddressRecord[] {
  return Array.from(addressStore.values()).filter((address) => address.customerId === customerId);
}

export function createCustomerAddress(
  customerId: string,
  input: NewCustomerAddressInput,
): {
  validation: CustomerValidationResult;
  address: CustomerAddressRecord | null;
} {
  const customer = customerStore.get(customerId);
  if (!customer) {
    return {
      validation: { valid: false, issues: [{ field: "customerId", message: "Customer not found." }] },
      address: null,
    };
  }

  const validation = validateNewCustomerAddressInput(input);
  if (!validation.valid) {
    return { validation, address: null };
  }

  const addressId = createAddressId(customerId, input.label);
  if (addressStore.has(addressId)) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "label", message: "An address with this generated identity already exists." }],
      },
      address: null,
    };
  }

  const timestamp = nowIso();
  if (input.defaultBilling || input.defaultShipping) {
    listCustomerAddresses(customerId).forEach((existingAddress) => {
      addressStore.set(existingAddress.addressId, {
        ...existingAddress,
        defaultBilling: input.defaultBilling ? false : existingAddress.defaultBilling,
        defaultShipping: input.defaultShipping ? false : existingAddress.defaultShipping,
        updatedAt: timestamp,
      });
    });
  }

  const address: CustomerAddressRecord = {
    ...input,
    addressId,
    customerId,
    organizationId: customer.organizationId,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  addressStore.set(addressId, address);
  synchronizeAddressDefaults(customerId);
  persistCurrentState();

  return { validation, address };
}

export function updateCustomerAddress(
  customerId: string,
  addressId: string,
  patch: UpdateCustomerAddressInput,
): {
  validation: CustomerValidationResult;
  address: CustomerAddressRecord | null;
} {
  const existing = addressStore.get(addressId);
  if (!existing || existing.customerId !== customerId) {
    return {
      validation: { valid: false, issues: [{ field: "addressId", message: "Address not found." }] },
      address: null,
    };
  }

  const validation = validateUpdateCustomerAddressInput(patch);
  if (!validation.valid) {
    return { validation, address: null };
  }

  const timestamp = nowIso();
  if (patch.defaultBilling || patch.defaultShipping) {
    listCustomerAddresses(customerId).forEach((entry) => {
      addressStore.set(entry.addressId, {
        ...entry,
        defaultBilling: patch.defaultBilling ? false : entry.defaultBilling,
        defaultShipping: patch.defaultShipping ? false : entry.defaultShipping,
        updatedAt: timestamp,
      });
    });
  }

  const updated: CustomerAddressRecord = {
    ...existing,
    ...patch,
    updatedAt: timestamp,
  };

  addressStore.set(addressId, updated);
  synchronizeAddressDefaults(customerId);
  persistCurrentState();

  return { validation, address: updated };
}

export function evaluateCustomerReadinessById(input: {
  customerId: string;
  requiredPermission: PermissionAction;
  permissions: Set<PermissionAction>;
}): CustomerReadinessResult | null {
  const customer = customerStore.get(input.customerId);
  if (!customer) {
    return null;
  }

  const contacts = listCustomerContacts(customer.customerId);
  const addresses = listCustomerAddresses(customer.customerId);
  return evaluateCustomerReadiness({
    customer,
    contacts,
    addresses,
    requiredPermission: input.requiredPermission,
    permissions: input.permissions,
  });
}

export function validateCustomerIntegrity(customerId: string): CustomerValidationResult {
  const customer = customerStore.get(customerId);
  if (!customer) {
    return {
      valid: false,
      issues: [{ field: "customerId", message: "Customer not found." }],
    };
  }

  return validateCustomerReadinessLinks({
    customer,
    contacts: listCustomerContacts(customerId),
    addresses: listCustomerAddresses(customerId),
  });
}

export function detectCustomerDuplicates(customerId: string): readonly CustomerDuplicateCandidate[] {
  const customer = customerStore.get(customerId);
  if (!customer) {
    return [];
  }

  const customerContacts = listCustomerContacts(customerId);
  const customerEmails = new Set(
    customerContacts
      .map((contact) => contact.email?.toLowerCase())
      .filter((value): value is string => Boolean(value)),
  );

  return listCustomers({ organizationId: customer.organizationId })
    .filter((candidate) => candidate.customerId !== customerId)
    .map((candidate) => {
      const reasons: string[] = [];

      if (normalizeToken(candidate.accountName) === normalizeToken(customer.accountName)) {
        reasons.push("account_name_match");
      }

      if (normalizeToken(candidate.accountCode) === normalizeToken(customer.accountCode)) {
        reasons.push("account_code_match");
      }

      const candidateEmails = new Set(
        listCustomerContacts(candidate.customerId)
          .map((contact) => contact.email?.toLowerCase())
          .filter((value): value is string => Boolean(value)),
      );

      const sharedEmail = Array.from(customerEmails).some((email) => candidateEmails.has(email));
      if (sharedEmail) {
        reasons.push("shared_contact_email");
      }

      const confidence = Math.min(0.99, reasons.length * 0.34);
      return {
        customerId,
        matchedCustomerId: candidate.customerId,
        reasons,
        confidence,
      };
    })
    .filter((candidate) => candidate.reasons.length > 0)
    .sort((left, right) => right.confidence - left.confidence);
}

export function resetCustomerRepositoryForTests(): void {
  const reset = resetPersistedState<CustomerRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: createSeedState,
  });

  applyState(reset.state);
  stateRevision = reset.revision;
}
