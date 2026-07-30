import { randomUUID } from "node:crypto";
import type { AuthenticationRequest, AuthenticationResult } from "../contracts";
import { AuthenticationContextFactory } from "./authentication-context-factory";
import { AuthenticationResultBuilder } from "./authentication-result-builder";
import { AuthenticationValidator } from "./authentication-validator";
import { AuthenticationAuditWriter } from "./authentication-audit-writer";
import type { AuthenticationProviderRegistry } from "../providers";
import type { GenesisSessionService } from "../session";
import {
  trackAuthenticationError,
  trackAuthenticationFailure,
  trackAuthenticationSuccess,
  trackCredentialRejected,
  trackProviderUnavailable,
} from "../telemetry/authentication-metrics";

export type AuthenticationPipelineDependencies = {
  providerRegistry: AuthenticationProviderRegistry;
  validator: AuthenticationValidator;
  contextFactory: AuthenticationContextFactory;
  resultBuilder: AuthenticationResultBuilder;
  sessionService: GenesisSessionService;
  auditWriter: AuthenticationAuditWriter;
};

export class AuthenticationPipeline {
  constructor(private readonly dependencies: AuthenticationPipelineDependencies) {}

  async authenticate(request: AuthenticationRequest): Promise<AuthenticationResult> {
    const validation = this.dependencies.validator.validateRequest(request);
    if (!validation.valid) {
      trackAuthenticationFailure(request.providerId ?? "unknown");
      trackCredentialRejected();
      await this.dependencies.auditWriter.loginFailure(request.providerId ?? "unknown", validation.reasonCode ?? "INVALID_CREDENTIAL");
      return this.dependencies.resultBuilder.failure({
        requestId: request.requestId,
        code: validation.reasonCode ?? "INVALID_CREDENTIAL",
        message: validation.reasonMessage ?? "Authentication request is invalid.",
      });
    }

    const provider = this.dependencies.providerRegistry.resolveForCredential(request.providerId, request.credential);
    if (!provider) {
      trackProviderUnavailable();
      await this.dependencies.auditWriter.providerUnavailable(request.providerId ?? "unknown");
      return this.dependencies.resultBuilder.failure({
        requestId: request.requestId,
        code: "PROVIDER_UNAVAILABLE",
        message: "No credential provider is available for this request.",
      });
    }

    try {
      const verification = await provider.verify(request.credential);
      if (!verification.valid || !verification.principalId || !verification.identityId) {
        trackAuthenticationFailure(provider.providerId);
        trackCredentialRejected();
        await this.dependencies.auditWriter.credentialRejected(provider.providerId);
        return this.dependencies.resultBuilder.failure({
          requestId: request.requestId,
          code: verification.reasonCode ?? "INVALID_CREDENTIAL",
          message: verification.reasonMessage ?? "Credential verification failed.",
        });
      }

      const context = this.dependencies.contextFactory.create({
        principalId: verification.principalId,
        identityId: verification.identityId,
        providerId: verification.providerId,
        method: "PASSWORD",
      });

      const issued = this.dependencies.sessionService.issueToken(verification.principalId);
      const session = {
        ...issued.descriptor,
        sessionId: randomUUID(),
        authenticationContextId: context.authenticationContextId,
      };

      trackAuthenticationSuccess(provider.providerId);
      await this.dependencies.auditWriter.loginSuccess(verification.principalId, provider.providerId);
      await this.dependencies.auditWriter.sessionCreated(verification.principalId);

      return this.dependencies.resultBuilder.success({
        requestId: request.requestId,
        principalId: verification.principalId,
        identityId: verification.identityId,
        context,
        session,
      });
    } catch {
      trackAuthenticationError();
      await this.dependencies.auditWriter.authenticationError(provider.providerId, "INTERNAL_IDENTITY_FAILURE");
      return this.dependencies.resultBuilder.failure({
        requestId: request.requestId,
        code: "INTERNAL_IDENTITY_FAILURE",
        message: "Authentication pipeline execution failed.",
      });
    }
  }
}
