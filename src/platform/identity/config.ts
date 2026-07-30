export type IdentityConfiguration = {
  contractVersion: "1.0.0";
  defaultProviderId: string;
  glw: {
    adminEmail: string;
    adminPassword: string;
    authSecret: string;
    sessionCookieName: string;
    sessionTtlSeconds: number;
    secureCookies: boolean;
  };
};

function getRequiredEnvironmentValue(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for Genesis Authentication Service.`);
  }

  return value;
}

export function getIdentityConfiguration(): IdentityConfiguration {
  return {
    contractVersion: "1.0.0",
    defaultProviderId: "glw-local",
    glw: {
      adminEmail: getRequiredEnvironmentValue("GLW_ADMIN_EMAIL").trim().toLowerCase(),
      adminPassword: getRequiredEnvironmentValue("GLW_ADMIN_PASSWORD"),
      authSecret: getRequiredEnvironmentValue("GLW_AUTH_SECRET"),
      sessionCookieName: "glw_session",
      sessionTtlSeconds: 60 * 60 * 12,
      secureCookies: process.env.NODE_ENV === "production",
    },
  };
}

export function getIdentityConfigurationDiagnostics(): {
  ok: boolean;
  providerId: string;
  secureCookies: boolean;
  sessionTtlSeconds: number;
  databaseConfigured: boolean;
  missingVariables: string[];
} {
  const required = ["GLW_ADMIN_EMAIL", "GLW_ADMIN_PASSWORD", "GLW_AUTH_SECRET"];
  const missingVariables = required.filter((name) => !process.env[name]);
  const databaseConfigured = Boolean(process.env.DATABASE_URL);

  return {
    ok: missingVariables.length === 0 && databaseConfigured,
    providerId: "glw-local",
    secureCookies: process.env.NODE_ENV === "production",
    sessionTtlSeconds: 60 * 60 * 12,
    databaseConfigured,
    missingVariables,
  };
}
