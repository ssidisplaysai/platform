import { listSites } from "./site-repository";
import type {
  CustomerAddressRecord,
  CustomerConfiguration,
  CustomerContactRecord,
  CustomerValidationIssue,
  CustomerValidationResult,
  NewCustomerAddressInput,
  NewCustomerContactInput,
  NewCustomerInput,
  UpdateCustomerAddressInput,
  UpdateCustomerContactInput,
  UpdateCustomerInput,
} from "./types";

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
}

function hasSecretLikeKeyword(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    normalized.includes("password") ||
    normalized.includes("secret") ||
    normalized.includes("token") ||
    normalized.includes("apikey") ||
    normalized.includes("private key") ||
    normalized.includes("sk-")
  );
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidCountryCode(value: string): boolean {
  return /^[A-Z]{2}$/.test(value);
}

function hasSite(siteId: string): boolean {
  return listSites().some((site) => site.siteId === siteId);
}

function validatePayloadForSecrets(
  payload: unknown,
  field: string,
  issues: CustomerValidationIssue[],
): void {
  const payloadText = JSON.stringify(payload);
  if (hasSecretLikeKeyword(payloadText)) {
    issues.push({
      field,
      message: "Raw secret-like values are not allowed.",
    });
  }
}

export function validateNewCustomerInput(input: NewCustomerInput): CustomerValidationResult {
  const issues: CustomerValidationIssue[] = [];

  if (isBlank(input.organizationId)) {
    issues.push({ field: "organizationId", message: "Organization is required." });
  }
  if (isBlank(input.accountName)) {
    issues.push({ field: "accountName", message: "Account name is required." });
  }
  if (isBlank(input.accountCode)) {
    issues.push({ field: "accountCode", message: "Account code is required." });
  }
  if (input.primarySiteId && !hasSite(input.primarySiteId)) {
    issues.push({ field: "primarySiteId", message: "Primary site must reference an existing site." });
  }

  input.associatedSiteIds.forEach((siteId, index) => {
    if (!hasSite(siteId)) {
      issues.push({
        field: `associatedSiteIds.${index}`,
        message: "Associated site must reference an existing site.",
      });
    }
  });

  if (!input.communicationPreferences.preferredFrequency) {
    issues.push({
      field: "communicationPreferences.preferredFrequency",
      message: "Preferred communication frequency is required.",
    });
  }

  validatePayloadForSecrets(input, "input", issues);

  return { valid: issues.length === 0, issues };
}

export function validateUpdateCustomerInput(
  existing: CustomerConfiguration,
  patch: UpdateCustomerInput,
): CustomerValidationResult {
  const issues: CustomerValidationIssue[] = [];

  if (Object.prototype.hasOwnProperty.call(patch, "customerId")) {
    issues.push({ field: "customerId", message: "Customer ID is immutable." });
  }

  if (
    Object.prototype.hasOwnProperty.call(patch, "organizationId") &&
    patch.organizationId !== existing.organizationId
  ) {
    issues.push({ field: "organizationId", message: "Organization reassignment is not allowed." });
  }

  if (patch.accountName !== undefined && isBlank(patch.accountName)) {
    issues.push({ field: "accountName", message: "Account name cannot be blank." });
  }

  if (patch.accountCode !== undefined && isBlank(patch.accountCode)) {
    issues.push({ field: "accountCode", message: "Account code cannot be blank." });
  }

  if (patch.primarySiteId !== undefined && patch.primarySiteId !== null && !hasSite(patch.primarySiteId)) {
    issues.push({ field: "primarySiteId", message: "Primary site must reference an existing site." });
  }

  if (patch.associatedSiteIds) {
    patch.associatedSiteIds.forEach((siteId, index) => {
      if (!hasSite(siteId)) {
        issues.push({
          field: `associatedSiteIds.${index}`,
          message: "Associated site must reference an existing site.",
        });
      }
    });
  }

  validatePayloadForSecrets(patch, "patch", issues);

  return { valid: issues.length === 0, issues };
}

export function validateNewCustomerContactInput(
  input: NewCustomerContactInput,
): CustomerValidationResult {
  const issues: CustomerValidationIssue[] = [];

  if (isBlank(input.fullName)) {
    issues.push({ field: "fullName", message: "Contact full name is required." });
  }

  if (input.email && !isValidEmail(input.email)) {
    issues.push({ field: "email", message: "Contact email is invalid." });
  }

  validatePayloadForSecrets(input, "input", issues);

  return { valid: issues.length === 0, issues };
}

export function validateUpdateCustomerContactInput(
  patch: UpdateCustomerContactInput,
): CustomerValidationResult {
  const issues: CustomerValidationIssue[] = [];

  if (patch.fullName !== undefined && isBlank(patch.fullName)) {
    issues.push({ field: "fullName", message: "Contact full name cannot be blank." });
  }

  if (patch.email !== undefined && patch.email !== null && !isValidEmail(patch.email)) {
    issues.push({ field: "email", message: "Contact email is invalid." });
  }

  validatePayloadForSecrets(patch, "patch", issues);

  return { valid: issues.length === 0, issues };
}

export function validateNewCustomerAddressInput(
  input: NewCustomerAddressInput,
): CustomerValidationResult {
  const issues: CustomerValidationIssue[] = [];

  if (isBlank(input.label)) {
    issues.push({ field: "label", message: "Address label is required." });
  }
  if (isBlank(input.line1)) {
    issues.push({ field: "line1", message: "Address line1 is required." });
  }
  if (isBlank(input.city)) {
    issues.push({ field: "city", message: "Address city is required." });
  }
  if (isBlank(input.region)) {
    issues.push({ field: "region", message: "Address region is required." });
  }
  if (isBlank(input.postalCode)) {
    issues.push({ field: "postalCode", message: "Postal code is required." });
  }
  if (!isValidCountryCode(input.countryCode)) {
    issues.push({ field: "countryCode", message: "Country code must be a two-letter ISO code." });
  }

  if (input.siteId && !hasSite(input.siteId)) {
    issues.push({ field: "siteId", message: "Address site must reference an existing site." });
  }

  validatePayloadForSecrets(input, "input", issues);

  return { valid: issues.length === 0, issues };
}

export function validateUpdateCustomerAddressInput(
  patch: UpdateCustomerAddressInput,
): CustomerValidationResult {
  const issues: CustomerValidationIssue[] = [];

  if (patch.label !== undefined && isBlank(patch.label)) {
    issues.push({ field: "label", message: "Address label cannot be blank." });
  }
  if (patch.line1 !== undefined && isBlank(patch.line1)) {
    issues.push({ field: "line1", message: "Address line1 cannot be blank." });
  }
  if (patch.city !== undefined && isBlank(patch.city)) {
    issues.push({ field: "city", message: "Address city cannot be blank." });
  }
  if (patch.region !== undefined && isBlank(patch.region)) {
    issues.push({ field: "region", message: "Address region cannot be blank." });
  }
  if (patch.postalCode !== undefined && isBlank(patch.postalCode)) {
    issues.push({ field: "postalCode", message: "Postal code cannot be blank." });
  }
  if (patch.countryCode !== undefined && !isValidCountryCode(patch.countryCode)) {
    issues.push({ field: "countryCode", message: "Country code must be a two-letter ISO code." });
  }

  if (patch.siteId !== undefined && patch.siteId !== null && !hasSite(patch.siteId)) {
    issues.push({ field: "siteId", message: "Address site must reference an existing site." });
  }

  validatePayloadForSecrets(patch, "patch", issues);

  return { valid: issues.length === 0, issues };
}

export function validateCustomerReadinessLinks(input: {
  customer: CustomerConfiguration;
  contacts: readonly CustomerContactRecord[];
  addresses: readonly CustomerAddressRecord[];
}): CustomerValidationResult {
  const issues: CustomerValidationIssue[] = [];

  if (input.customer.primaryContactId) {
    const contactExists = input.contacts.some(
      (contact) => contact.contactId === input.customer.primaryContactId,
    );
    if (!contactExists) {
      issues.push({
        field: "primaryContactId",
        message: "Primary contact must reference an existing contact.",
      });
    }
  }

  if (input.customer.billingAddressId) {
    const billingExists = input.addresses.some(
      (address) => address.addressId === input.customer.billingAddressId,
    );
    if (!billingExists) {
      issues.push({
        field: "billingAddressId",
        message: "Billing address must reference an existing address.",
      });
    }
  }

  if (input.customer.shippingAddressId) {
    const shippingExists = input.addresses.some(
      (address) => address.addressId === input.customer.shippingAddressId,
    );
    if (!shippingExists) {
      issues.push({
        field: "shippingAddressId",
        message: "Shipping address must reference an existing address.",
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
