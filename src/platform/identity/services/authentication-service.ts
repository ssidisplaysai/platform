import { randomUUID } from "node:crypto";
import type { AuthenticationRequest, AuthenticationResult } from "../contracts";
import type { AuthenticationService as AuthenticationServicePort, IdentityHealthContributor } from "../ports";
import { getIdentityConfiguration, getIdentityConfigurationDiagnostics } from "../config";
import { AuthenticationProviderRegistry, LocalCredentialProvider } from "../providers";
import { GlwSessionCodec, GenesisSessionService } from "../session";
import { AuthenticationAuditWriter } from "./authentication-audit-writer";
import { AuthenticationContextFactory } from "./authentication-context-factory";
import { AuthenticationPipeline } from "./authentication-pipeline";
import { AuthenticationResultBuilder } from "./authentication-result-builder";
import { AuthenticationValidator } from "./authentication-validator";
import { getAuthenticationMetricsSnapshot, trackLogout } from "../telemetry/authentication-metrics";

export class GenesisAuthenticationService implements AuthenticationServicePort, IdentityHealthContributor {
  private readonly providerRegistry: AuthenticationProviderRegistry;
  private readonly sessionCodec: GlwSessionCodec;
  private readonly sessionService: GenesisSessionService;
  private readonly pipeline: AuthenticationPipeline;
  private readonly auditWriter: AuthenticationAuditWriter;

  constructor() {
    const config = getIdentityConfiguration();
    this.providerRegistry = new AuthenticationProviderRegistry();
    this.providerRegistry.register(new LocalCredentialProvider({
      providerId: config.defaultProviderId,
      adminEmail: config.glw.adminEmail,
      adminPassword: config.glw.adminPassword,
    }));

    this.sessionCodec = new GlwSessionCodec(config.glw.authSecret, config.glw.sessionTtlSeconds);
    this.sessionService = new GenesisSessionService(this.sessionCodec);
    this.auditWriter = new AuthenticationAuditWriter();

    this.pipeline = new AuthenticationPipeline({
      providerRegistry: this.providerRegistry,
      validator: new AuthenticationValidator(),
      contextFactory: new AuthenticationContextFactory(),
      resultBuilder: new AuthenticationResultBuilder(),
      sessionService: this.sessionService,
      auditWriter: this.auditWriter,
    });
  }

  authenticate(request: AuthenticationRequest): Promise<AuthenticationResult> {
    return this.pipeline.authenticate(request);
  }

  async authenticatePassword(email: string, password: string): Promise<AuthenticationResult> {
    return this.authenticate({
      requestId: randomUUID(),
      providerId: getIdentityConfiguration().defaultProviderId,
      credential: {
        credentialId: randomUUID(),
        kind: "PASSWORD",
        keyReference: `${email.trim().toLowerCase()}\n${password}`,
      },
    });
  }

  createSessionToken(email: string) {
    return this.sessionService.issueToken(email);
  }

  readSessionToken(token: string) {
    return this.sessionService.readToken(token);
  }

  renewSessionToken(token: string) {
    return this.sessionService.renewToken(token);
  }

  async revokeSessionToken(token: string, principalId?: string) {
    const revoked = await this.sessionService.revokeToken(token, "SESSION_REVOKED", principalId);
    if (revoked && principalId) {
      await this.auditWriter.sessionRevoked(principalId);
    }
  }

  async recordLogout(principalId?: string) {
    trackLogout();
    if (principalId) {
      await this.auditWriter.logout(principalId);
    }
  }

  getMetrics() {
    return getAuthenticationMetricsSnapshot();
  }

  getProviderHealth() {
    return this.providerRegistry.healthSummary();
  }

  async healthSnapshot() {
    const diagnostics = getIdentityConfigurationDiagnostics();
    const providerHealth = this.getProviderHealth();
    const metrics = this.getMetrics();
    const activeSessions = await this.sessionService.countActiveSessions();

    const status: "HEALTHY" | "CRITICAL" = diagnostics.ok ? "HEALTHY" : "CRITICAL";
    const checks: Array<{ name: string; status: "PASS" | "WARN" | "FAIL"; detail?: string }> = [
      {
        name: "configuration",
        status: diagnostics.missingVariables.length === 0 ? "PASS" : "FAIL",
        detail: diagnostics.missingVariables.length === 0
          ? "Authentication configuration is valid."
          : `Missing: ${diagnostics.missingVariables.join(", ")}`,
      },
      {
        name: "startup",
        status: diagnostics.databaseConfigured ? "PASS" : "FAIL",
        detail: diagnostics.databaseConfigured
          ? "DATABASE_URL is configured for durable identity persistence."
          : "DATABASE_URL is required for durable revocation and audit persistence.",
      },
      {
        name: "provider",
        status: providerHealth.every((entry) => entry.status === "HEALTHY") ? "PASS" : "WARN",
        detail: providerHealth.map((entry) => `${entry.providerId}:${entry.status}`).join("; "),
      },
      {
        name: "session",
        status: "PASS",
        detail: `active=${activeSessions}; inMemoryMetric=${metrics.activeSessionCount}`,
      },
    ];

    return {
      status,
      checks,
      generatedAt: new Date().toISOString(),
    };
  }
}

let singleton: GenesisAuthenticationService | null = null;

export function getGenesisAuthenticationService(): GenesisAuthenticationService {
  if (!singleton) {
    singleton = new GenesisAuthenticationService();
  }

  return singleton;
}
