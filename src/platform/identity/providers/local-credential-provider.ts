import { timingSafeEqual } from "node:crypto";
import type { CredentialReference } from "../contracts";
import type { CredentialProvider, CredentialVerificationResult } from "./credential-provider";

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export type LocalCredentialProviderOptions = {
  providerId: string;
  adminEmail: string;
  adminPassword: string;
};

export class LocalCredentialProvider implements CredentialProvider {
  readonly providerId: string;
  private readonly adminEmail: string;
  private readonly adminPassword: string;

  constructor(options: LocalCredentialProviderOptions) {
    this.providerId = options.providerId;
    this.adminEmail = options.adminEmail.trim().toLowerCase();
    this.adminPassword = options.adminPassword;
  }

  supports(credential: CredentialReference): boolean {
    return credential.kind === "PASSWORD";
  }

  async verify(credential: CredentialReference): Promise<CredentialVerificationResult> {
    if (!credential.keyReference) {
      return {
        valid: false,
        providerId: this.providerId,
        reasonCode: "INVALID_CREDENTIAL",
        reasonMessage: "Credential key reference is required.",
      };
    }

    const [email, password] = credential.keyReference.split("\n");
    if (!email || password === undefined) {
      return {
        valid: false,
        providerId: this.providerId,
        reasonCode: "INVALID_CREDENTIAL",
        reasonMessage: "Credential payload format is invalid.",
      };
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailMatch = safeEquals(normalizedEmail, this.adminEmail);
    const passwordMatch = safeEquals(password, this.adminPassword);

    if (!emailMatch || !passwordMatch) {
      return {
        valid: false,
        providerId: this.providerId,
        reasonCode: "INVALID_CREDENTIAL",
        reasonMessage: "Credential verification failed.",
      };
    }

    return {
      valid: true,
      providerId: this.providerId,
      principalId: normalizedEmail,
      identityId: normalizedEmail,
    };
  }

  health() {
    return {
      status: "HEALTHY" as const,
      detail: "Local credential provider configured.",
    };
  }
}
