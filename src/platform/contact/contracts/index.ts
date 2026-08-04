export type ContactId = string;
export type TenantId = string;
export type OrganizationId = string;

export type ContactType = "PERSON" | "PARTY";

export type ContactStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED" | "MERGED" | "DECEASED" | "BLOCKED";

export type ContactClassification =
  | "CUSTOMER"
  | "EMPLOYEE"
  | "VENDOR"
  | "PARTNER"
  | "DEALER"
  | "AMBASSADOR"
  | "INFLUENCER"
  | "CONTRACTOR"
  | "APPLICANT"
  | "LEAD";

export type ConsentType = "EMAIL_MARKETING" | "SMS_MARKETING" | "PHONE_CONTACT" | "DATA_PROCESSING";

export type ConsentStatus = "GRANTED" | "WITHDRAWN" | "EXPIRED" | "DENIED";

export type ContactMethodType = "EMAIL" | "PHONE" | "POSTAL";

export type ContactRole =
  | "EMPLOYMENT"
  | "VENDOR"
  | "DEALER"
  | "PARTNER"
  | "AMBASSADOR"
  | "CUSTOMER"
  | "CONTRACTOR";

export type ContactMetadata = Record<string, string | number | boolean | null>;
export type ContactSettings = Record<string, string | number | boolean | null>;

export type ContactActorContext = {
  actorId: string;
  correlationId?: string;
  causationId?: string;
  source?: string;
  occurredAt: string;
};

export type PersonName = {
  legalGivenName: string;
  legalFamilyName: string;
  legalMiddleName?: string;
  preferredGivenName?: string;
  preferredFamilyName?: string;
  displayName: string;
  normalizedFullName: string;
};

export type EmailAddress = {
  methodId: string;
  value: string;
  normalizedValue: string;
  label?: string;
  primary: boolean;
  verified: boolean;
  valid: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
  consentRecordIds: string[];
};

export type PhoneNumber = {
  methodId: string;
  value: string;
  normalizedValue: string;
  label?: string;
  primary: boolean;
  verified: boolean;
  valid: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
  consentRecordIds: string[];
};

export type PostalAddress = {
  methodId: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode?: string;
  countryCode: string;
  normalizedValue: string;
  label?: string;
  primary: boolean;
  valid: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
};

export type ContactMethod =
  | { type: "EMAIL"; email: EmailAddress }
  | { type: "PHONE"; phone: PhoneNumber }
  | { type: "POSTAL"; postal: PostalAddress };

export type OrganizationAffiliation = {
  affiliationId: string;
  contactId: ContactId;
  tenantId: TenantId;
  organizationId: OrganizationId;
  role: ContactRole;
  primary: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
  metadata?: ContactMetadata;
};

export type ContactPreference = {
  preferenceId: string;
  contactId: ContactId;
  tenantId: TenantId;
  preferredLanguage?: string;
  preferredTimeZone?: string;
  preferredContactMethodType?: ContactMethodType;
  channelPreferences: Partial<Record<ContactMethodType, "PREFERRED" | "ALLOWED" | "DISALLOWED">>;
  communicationFrequency?: "LOW" | "NORMAL" | "HIGH";
  quietHoursReference?: string;
  accessibilityPreferences?: string[];
  effectiveFrom?: string;
  effectiveTo?: string;
  version: number;
};

export type ConsentRecord = {
  consentRecordId: string;
  contactId: ContactId;
  tenantId: TenantId;
  type: ConsentType;
  status: ConsentStatus;
  jurisdiction?: string;
  captureSource?: string;
  capturedAt: string;
  expiresAt?: string;
  withdrawnAt?: string;
  evidenceReference?: string;
  actor: ContactActorContext;
  version: number;
};

export type CommunicationEligibility = {
  contactId: ContactId;
  tenantId: TenantId;
  channel: ContactMethodType;
  eligible: boolean;
  blockedByStatus: boolean;
  blockedByMethod: boolean;
  blockedByConsent: boolean;
  blockedByPreference: boolean;
  reasons: string[];
  evaluatedAt: string;
};

export type IdentityLink = {
  identityLinkId: string;
  identityProvider: string;
  subjectId: string;
  externalIdentifier?: string;
  actor: ContactActorContext;
  linkedAt: string;
};

export type MergeRecord = {
  mergeRecordId: string;
  sourceContactId: ContactId;
  targetContactId: ContactId;
  tenantId: TenantId;
  mergedAt: string;
  actor: ContactActorContext;
  mergedMethodIds: string[];
  preservedConsentRecordIds: string[];
  notes?: string;
};

export type MergeIdempotencyRecord = {
  idempotencyKey: string;
  tenantId: TenantId;
  sourceContactId: ContactId;
  targetContactId: ContactId;
  mergeRecordId: string;
  createdAt: string;
  expiresAt: string;
};

export type DeduplicationDecision = {
  candidateContactId: ContactId;
  score: number;
  reasons: string[];
  deterministicHash: string;
};

export type ContactVersion = {
  version: number;
  changedAt: string;
  actorId: string;
  changeSummary: string;
};

export type Contact = {
  contactId: ContactId;
  tenantId: TenantId;
  organizationId: OrganizationId;
  type: ContactType;
  status: ContactStatus;
  personName: PersonName;
  classifications: Array<{
    classificationId: string;
    value: ContactClassification;
    effectiveFrom?: string;
    effectiveTo?: string;
    version: number;
    actor: ContactActorContext;
  }>;
  methods: ContactMethod[];
  affiliations: OrganizationAffiliation[];
  preferences: ContactPreference[];
  consentHistory: ConsentRecord[];
  identityLinks: IdentityLink[];
  mergeHistory: MergeRecord[];
  metadata: ContactMetadata;
  settings: ContactSettings;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  version: number;
  versionHistory: ContactVersion[];
  mergedIntoContactId?: ContactId;
};

export type ContactAuditRecord = {
  auditId: string;
  eventType: string;
  contactId?: ContactId;
  tenantId?: TenantId;
  actor?: ContactActorContext;
  message: string;
  details?: Record<string, unknown>;
  recordedAt: string;
};

export type ContactMetrics = {
  registeredContacts: number;
  activeContacts: number;
  inactiveContacts: number;
  archivedContacts: number;
  mergedContacts: number;
  blockedContacts: number;
  verifiedEmailMethods: number;
  verifiedPhoneMethods: number;
  activeAffiliations: number;
  consentGrants: number;
  consentWithdrawals: number;
  eligibleContactsByChannel: Record<ContactMethodType, number>;
  duplicateCandidates: number;
  mergeOperations: number;
  mergeFailures: number;
  recoveryCount: number;
  corruptStateCount: number;
  auditFailureCount: number;
  oldestUnreviewedDuplicateAgeMinutes: number;
  mergeIdempotencyRecords: number;
  mergeIdempotencyRejections: number;
  mergeIdempotencyExpiredCleanups: number;
};

export type ContactHealth = {
  status: "HEALTHY" | "DEGRADED";
  generatedAt: string;
  checks: Array<{
    name:
      | "registry"
      | "methods"
      | "affiliations"
      | "preferences"
      | "consent"
      | "eligibility"
      | "deduplication"
      | "merge"
      | "persistence"
      | "recovery"
      | "audit"
      | "configuration";
    status: "PASS" | "WARN" | "FAIL";
    detail: string;
  }>;
};

export type ContactErrorCode =
  | "CONTACT_DUPLICATE_ID"
  | "CONTACT_INVALID"
  | "TENANT_INVALID"
  | "ORGANIZATION_REFERENCE_INVALID"
  | "CROSS_TENANT_AFFILIATION"
  | "CONTACT_METHOD_DUPLICATE"
  | "LIFECYCLE_TRANSITION_INVALID"
  | "CONSENT_TRANSITION_INVALID"
  | "MERGE_CONFLICT"
  | "CROSS_TENANT_MERGE"
  | "STATE_CORRUPT"
  | "PERSISTENCE_FAILURE"
  | "RECOVERY_FAILURE"
  | "AUDIT_FAILURE";

export type ContactErrorSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export class ContactError extends Error {
  constructor(
    public readonly code: ContactErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly auditRequired: boolean,
    public readonly severity: ContactErrorSeverity,
  ) {
    super(message);
    this.name = "ContactError";
  }
}

export type ContactPlatformDependencies = {
  identity: {
    resolveIdentity(actorId: string): Promise<{ actorId: string; actorName?: string } | null>;
  };
  authorization: {
    authorize(input: {
      actorId: string;
      action: string;
      tenantId: TenantId;
      contactId?: ContactId;
    }): Promise<{ allowed: boolean; reason?: string }>;
  };
  organization: {
    organizationExists(input: { organizationId: OrganizationId; tenantId: TenantId }): Promise<boolean>;
  };
  messaging: { inspectHealth(): Promise<{ status: "HEALTHY" | "DEGRADED"; detail: string }> };
  workflow: { inspectHealth(): Promise<{ status: "HEALTHY" | "DEGRADED"; detail: string }> };
  scheduling: { inspectHealth(): Promise<{ status: "HEALTHY" | "DEGRADED"; detail: string }> };
  notifications: { inspectHealth(): Promise<{ status: "HEALTHY" | "DEGRADED"; detail: string }> };
  ai: { inspectHealth(): Promise<{ status: "HEALTHY" | "DEGRADED"; detail: string }> };
};

export type ContactPersistedState = {
  schemaVersion: "1.0.0";
  contacts: Contact[];
  audits: ContactAuditRecord[];
  metrics: ContactMetrics;
  duplicateBacklog: Array<{ contactId: ContactId; firstDetectedAt: string }>;
  mergeIdempotencyRecords: MergeIdempotencyRecord[];
};

export function createDefaultContactMetrics(): ContactMetrics {
  return {
    registeredContacts: 0,
    activeContacts: 0,
    inactiveContacts: 0,
    archivedContacts: 0,
    mergedContacts: 0,
    blockedContacts: 0,
    verifiedEmailMethods: 0,
    verifiedPhoneMethods: 0,
    activeAffiliations: 0,
    consentGrants: 0,
    consentWithdrawals: 0,
    eligibleContactsByChannel: { EMAIL: 0, PHONE: 0, POSTAL: 0 },
    duplicateCandidates: 0,
    mergeOperations: 0,
    mergeFailures: 0,
    recoveryCount: 0,
    corruptStateCount: 0,
    auditFailureCount: 0,
    oldestUnreviewedDuplicateAgeMinutes: 0,
    mergeIdempotencyRecords: 0,
    mergeIdempotencyRejections: 0,
    mergeIdempotencyExpiredCleanups: 0,
  };
}

export function createDefaultContactPersistedState(): ContactPersistedState {
  return {
    schemaVersion: "1.0.0",
    contacts: [],
    audits: [],
    metrics: createDefaultContactMetrics(),
    duplicateBacklog: [],
    mergeIdempotencyRecords: [],
  };
}
