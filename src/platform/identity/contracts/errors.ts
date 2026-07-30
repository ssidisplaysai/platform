export const identityErrorCodes = [
  "IDENTITY_NOT_FOUND",
  "INVALID_CREDENTIAL",
  "EXPIRED_CREDENTIAL",
  "DISABLED_IDENTITY",
  "INVALID_SESSION",
  "EXPIRED_SESSION",
  "REVOKED_SESSION",
  "MISSING_MEMBERSHIP",
  "PERMISSION_DENIED",
  "POLICY_DENIED",
  "PROVIDER_UNAVAILABLE",
  "FEDERATION_FAILURE",
  "CONTRACT_MISMATCH",
  "AUDIT_FAILURE",
  "INTERNAL_IDENTITY_FAILURE",
] as const;

export type IdentityErrorCode = (typeof identityErrorCodes)[number];

export type IdentityError = {
  code: IdentityErrorCode;
  message: string;
  retryable: boolean;
  httpStatusHint: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 503;
  auditRequired: boolean;
  exposeMessageToClient: boolean;
};
