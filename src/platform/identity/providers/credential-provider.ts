import type { CredentialReference } from "../contracts";

export type CredentialVerificationResult = {
  valid: boolean;
  providerId: string;
  principalId?: string;
  identityId?: string;
  reasonCode?: string;
  reasonMessage?: string;
};

export type CredentialProvider = {
  providerId: string;
  supports(credential: CredentialReference): boolean;
  verify(credential: CredentialReference): Promise<CredentialVerificationResult>;
  health(): { status: "HEALTHY" | "DEGRADED" | "CRITICAL"; detail?: string };
};
