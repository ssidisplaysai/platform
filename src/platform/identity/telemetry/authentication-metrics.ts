type AuthenticationMetrics = {
  loginSuccessCount: number;
  loginFailureCount: number;
  providerUnavailableCount: number;
  authenticationErrorCount: number;
  credentialRejectedCount: number;
  sessionCreatedCount: number;
  sessionExpiredCount: number;
  sessionRevokedCount: number;
  sessionRenewedCount: number;
  logoutCount: number;
  activeSessionCount: number;
  providers: Record<string, { success: number; failure: number }>;
};

const metrics: AuthenticationMetrics = {
  loginSuccessCount: 0,
  loginFailureCount: 0,
  providerUnavailableCount: 0,
  authenticationErrorCount: 0,
  credentialRejectedCount: 0,
  sessionCreatedCount: 0,
  sessionExpiredCount: 0,
  sessionRevokedCount: 0,
  sessionRenewedCount: 0,
  logoutCount: 0,
  activeSessionCount: 0,
  providers: {},
};

function ensureProvider(providerId: string) {
  if (!metrics.providers[providerId]) {
    metrics.providers[providerId] = { success: 0, failure: 0 };
  }

  return metrics.providers[providerId];
}

export function trackAuthenticationSuccess(providerId: string) {
  metrics.loginSuccessCount += 1;
  ensureProvider(providerId).success += 1;
}

export function trackAuthenticationFailure(providerId: string) {
  metrics.loginFailureCount += 1;
  ensureProvider(providerId).failure += 1;
}

export function trackCredentialRejected() {
  metrics.credentialRejectedCount += 1;
}

export function trackProviderUnavailable() {
  metrics.providerUnavailableCount += 1;
}

export function trackAuthenticationError() {
  metrics.authenticationErrorCount += 1;
}

export function trackSessionCreated() {
  metrics.sessionCreatedCount += 1;
  metrics.activeSessionCount += 1;
}

export function trackSessionExpired() {
  metrics.sessionExpiredCount += 1;
  metrics.activeSessionCount = Math.max(0, metrics.activeSessionCount - 1);
}

export function trackSessionRevoked() {
  metrics.sessionRevokedCount += 1;
  metrics.activeSessionCount = Math.max(0, metrics.activeSessionCount - 1);
}

export function trackSessionRenewed() {
  metrics.sessionRenewedCount += 1;
}

export function trackLogout() {
  metrics.logoutCount += 1;
}

export function getAuthenticationMetricsSnapshot() {
  return {
    ...metrics,
    providers: { ...metrics.providers },
  };
}
