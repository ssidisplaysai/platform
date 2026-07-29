import type {
  SiteConfiguration,
  SiteConnectionTestResult,
} from "./types";

export interface SiteConnectionTestAdapter {
  testConnection(site: SiteConfiguration): Promise<SiteConnectionTestResult>;
}

export class FoundationSiteConnectionTestAdapter
  implements SiteConnectionTestAdapter {
  async testConnection(site: SiteConfiguration): Promise<SiteConnectionTestResult> {
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

    return {
      status: "unavailable",
      message: "External connection tests are unavailable in this bounded package.",
      checkedAt,
      details: "No runtime WordPress or n8n call is performed by GCP-0002C foundation.",
    };
  }
}
