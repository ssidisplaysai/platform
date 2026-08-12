export type ApplicationLifecycleState = "REGISTERED" | "ACTIVE" | "INACTIVE" | "DEPRECATED";

export type ApplicationIdentity = {
  applicationId: string;
  code: string;
  displayName: string;
};

export type ApplicationStatus = {
  lifecycleState: ApplicationLifecycleState;
  activatedAt?: string;
  deactivatedAt?: string;
  deactivationReason?: string;
};

export type ApplicationMetadata = {
  description: string;
  tags: string[];
  discovery: {
    launchPath: string;
    baseUrl?: string;
    iconKey?: string;
  };
};

export type ApplicationCapabilities = {
  declared: string[];
};

export type ApplicationHealthReference = {
  healthEndpoint: string;
  capabilityEndpoint?: string;
  contractVersion: string;
};

export type ApplicationVersion = {
  version: string;
  releaseDate?: string;
};

export type ApplicationCompatibility = {
  registryContractVersion: string;
  supportedHealthContractVersions: string[];
  supportedCapabilityContractVersions: string[];
};

export type ApplicationOwnership = {
  ownerOrganization: string;
  ownerTeam: string;
  technicalContact: string;
  supportContact?: string;
};

export type ApplicationRegistration = {
  identity: ApplicationIdentity;
  status: ApplicationStatus;
  metadata: ApplicationMetadata;
  capabilities: ApplicationCapabilities;
  healthReference: ApplicationHealthReference;
  version: ApplicationVersion;
  compatibility: ApplicationCompatibility;
  ownership: ApplicationOwnership;
  createdAt: string;
  updatedAt: string;
};

export type EnterpriseApplication = {
  registration: ApplicationRegistration;
};

export type RegistrationSearchQuery = {
  lifecycleState?: ApplicationLifecycleState;
  capability?: string;
  ownerOrganization?: string;
  q?: string;
  limit?: number;
};

export type RegisterApplicationInput = Omit<ApplicationRegistration, "createdAt" | "updatedAt">;

export type UpdateRegistrationInput = Partial<Omit<ApplicationRegistration, "identity" | "createdAt" | "updatedAt">> & {
  identity?: never;
};

export type ValidationIssue = {
  field: string;
  code:
    | "REQUIRED"
    | "DUPLICATE"
    | "INVALID_FORMAT"
    | "INVALID_VALUE"
    | "INVALID_TRANSITION"
    | "UNSUPPORTED_VERSION";
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
};

export type CompatibilityValidationInput = {
  applicationId: string;
  registryContractVersion: string;
  requiredHealthContractVersion?: string;
  requiredCapabilityContractVersion?: string;
};

export type CompatibilityValidationResult = ValidationResult & {
  compatible: boolean;
};
