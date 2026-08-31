import {
  createAuthenticatedWordPressReadAuthority,
} from "./authenticated-wordpress-read-authority";
import {
  resolveWordPressCredentialReference,
} from "./wordpress-credential-resolver";
import type {
  SiteConfiguration,
  SiteConnectionTestResult,
} from "./types";

export interface SiteConnectionTestAdapter {
  testConnection(site: SiteConfiguration): Promise<SiteConnectionTestResult>;
}

export class FoundationSiteConnectionTestAdapter
  implements SiteConnectionTestAdapter {

  async testConnection(
    site: SiteConfiguration,
  ): Promise<SiteConnectionTestResult> {
    const checkedAt = new Date().toISOString();

    if (!site.integrations.wordpressApiBaseUrl) {
      return {
        status: "not_configured",
        message: "WordPress API URL is not configured for this site.",
        checkedAt,
      };
    }

    if (!site.integrations.wordpressCredentialReference) {
      return {
        status: "not_configured",
        message: "WordPress credential reference is not configured for this site.",
        checkedAt,
      };
    }

    const credential = resolveWordPressCredentialReference(
      site.integrations.wordpressCredentialReference,
    );

    if (!credential) {
      return {
        status: "unavailable",
        message: "WordPress credentials could not be resolved.",
        checkedAt,
        details:
          `Credential reference '${site.integrations.wordpressCredentialReference}' is configured, but its environment-backed credentials are not available to the GLW runtime.`,
      };
    }

    const authority = createAuthenticatedWordPressReadAuthority({
      configuration: {
        apiBaseUrl: site.integrations.wordpressApiBaseUrl,
        username: credential.username,
        applicationPassword: credential.applicationPassword,
        timeoutMs: 10_000,
      },
    });

    const query = new URLSearchParams({
      context: "edit",
      per_page: "1",
      _fields: "id,status",
    });

    const read = await authority.getJson({
      path: "/pages",
      query,
    });

    if (read.ok) {
      return {
        status: "success" as SiteConnectionTestResult["status"],
        message: "Authenticated WordPress connection successful.",
        checkedAt,
        details:
          "GLW successfully completed an authenticated read-only WordPress REST request.",
      };
    }

    if (read.reason === "AUTH_FAILURE") {
      return {
        status: "failed" as SiteConnectionTestResult["status"],
        message: "WordPress authentication failed.",
        checkedAt,
        details:
          "The WordPress API responded, but the configured username/application password was rejected.",
      };
    }

    if (read.reason === "READ_TIMEOUT") {
      return {
        status: "failed" as SiteConnectionTestResult["status"],
        message: "WordPress connection timed out.",
        checkedAt,
        details:
          "GLW could not complete the authenticated WordPress read within the configured timeout.",
      };
    }

    return {
      status: "failed" as SiteConnectionTestResult["status"],
      message: "WordPress connection test failed.",
      checkedAt,
      details: `Read failure: ${read.reason}`,
    };
  }
}
