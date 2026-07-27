import { stablePublishingFingerprint, type GmpPublishingDestination, type GmpPublishingManifest } from "./publishing-models";

export type GmpDestinationAdapterPublishResult = {
  success: boolean;
  externalObjectType: string;
  externalObjectId: string;
  externalRevisionId?: string;
  externalUrl: string;
  status: string;
  response: Record<string, unknown>;
};

export type GmpDestinationAdapterVerificationResult = {
  available: boolean;
  remoteState: Record<string, unknown>;
};

export type GmpDestinationAdapter = {
  adapterId: string;
  destinationType: string;
  adapterVersion: string;
  validateConnection: (destination: GmpPublishingDestination) => Promise<{ ok: boolean; warnings: string[]; blockingIssues: string[] }>;
  getCapabilities: (destination: GmpPublishingDestination) => Promise<Record<string, boolean>>;
  validatePackage: (manifest: GmpPublishingManifest) => Promise<{ ok: boolean; warnings: string[]; blockingIssues: string[] }>;
  preparePayload: (manifest: GmpPublishingManifest) => Promise<Record<string, unknown>>;
  publish: (destination: GmpPublishingDestination, manifest: GmpPublishingManifest) => Promise<GmpDestinationAdapterPublishResult>;
  update: (destination: GmpPublishingDestination, manifest: GmpPublishingManifest, remoteObjectId: string) => Promise<GmpDestinationAdapterPublishResult>;
  schedule: (destination: GmpPublishingDestination, manifest: GmpPublishingManifest, scheduleAtIso: string) => Promise<GmpDestinationAdapterPublishResult>;
  archive: (destination: GmpPublishingDestination, remoteObjectId: string) => Promise<{ success: boolean }>;
  delete: (destination: GmpPublishingDestination, remoteObjectId: string) => Promise<{ success: boolean }>;
  rollback: (destination: GmpPublishingDestination, remoteObjectId: string, rollbackTargetRevisionId?: string) => Promise<{ success: boolean }>;
  verify: (destination: GmpPublishingDestination, remoteObjectId: string) => Promise<GmpDestinationAdapterVerificationResult>;
  fetchRemoteState: (destination: GmpPublishingDestination, remoteObjectId: string) => Promise<Record<string, unknown> | null>;
};

export type GmpWordpressTransport = {
  validateConnection: (destination: GmpPublishingDestination) => Promise<{ ok: boolean; warnings: string[]; blockingIssues: string[] }>;
  upsertContent: (input: { destination: GmpPublishingDestination; payload: Record<string, unknown>; remoteObjectId?: string; scheduleAtIso?: string }) => Promise<GmpDestinationAdapterPublishResult>;
  getRemoteState: (input: { destination: GmpPublishingDestination; remoteObjectId: string }) => Promise<Record<string, unknown> | null>;
};

export function createMockPublishingAdapter(): GmpDestinationAdapter {
  return {
    adapterId: "gmp-mock-adapter",
    destinationType: "CUSTOM_ADAPTER",
    adapterVersion: "gmp-mock-adapter/v1",
    async validateConnection() {
      return { ok: true, warnings: [], blockingIssues: [] };
    },
    async getCapabilities(destination) {
      return destination.capabilityProfile;
    },
    async validatePackage() {
      return { ok: true, warnings: [], blockingIssues: [] };
    },
    async preparePayload(manifest) {
      return {
        title: manifest.pageIdentity.title,
        slug: manifest.pageIdentity.slug,
        content: manifest.contentPayloadReference,
        seo: manifest.seoPayload,
      };
    },
    async publish(destination, manifest) {
      const objectId = stablePublishingFingerprint({ destinationId: destination.destinationId, packageId: manifest.packageId }).slice(0, 16);
      return {
        success: true,
        externalObjectType: "page",
        externalObjectId: objectId,
        externalRevisionId: `rev_${Date.now()}`,
        externalUrl: `${destination.baseUrl.replace(/\/$/, "")}/${String(manifest.pageIdentity.slug ?? "page")}`,
        status: "published",
        response: { mode: "create" },
      };
    },
    async update(destination, manifest, remoteObjectId) {
      return {
        success: true,
        externalObjectType: "page",
        externalObjectId: remoteObjectId,
        externalRevisionId: `rev_${Date.now()}`,
        externalUrl: `${destination.baseUrl.replace(/\/$/, "")}/${String(manifest.pageIdentity.slug ?? "page")}`,
        status: "updated",
        response: { mode: "update" },
      };
    },
    async schedule(destination, manifest) {
      return {
        success: true,
        externalObjectType: "page",
        externalObjectId: stablePublishingFingerprint({ destinationId: destination.destinationId, packageId: manifest.packageId }).slice(0, 16),
        externalRevisionId: `rev_${Date.now()}`,
        externalUrl: `${destination.baseUrl.replace(/\/$/, "")}/${String(manifest.pageIdentity.slug ?? "page")}`,
        status: "scheduled",
        response: { mode: "schedule" },
      };
    },
    async archive() {
      return { success: true };
    },
    async delete() {
      return { success: true };
    },
    async rollback() {
      return { success: true };
    },
    async verify(destination, remoteObjectId) {
      return {
        available: true,
        remoteState: {
          remoteObjectId,
          status: "publish",
          baseUrl: destination.baseUrl,
        },
      };
    },
    async fetchRemoteState(destination, remoteObjectId) {
      return {
        remoteObjectId,
        url: `${destination.baseUrl.replace(/\/$/, "")}/${remoteObjectId}`,
      };
    },
  };
}

export function createWordpressDestinationAdapter(transport: GmpWordpressTransport): GmpDestinationAdapter {
  return {
    adapterId: "gmp-wordpress-adapter",
    destinationType: "WORDPRESS",
    adapterVersion: "gmp-wordpress-adapter/v1",
    async validateConnection(destination) {
      return transport.validateConnection(destination);
    },
    async getCapabilities(destination) {
      return destination.capabilityProfile;
    },
    async validatePackage(manifest) {
      const blockingIssues: string[] = [];
      if (!manifest.contentPayloadReference || Object.keys(manifest.contentPayloadReference).length === 0) {
        blockingIssues.push("content_payload_missing");
      }
      return { ok: blockingIssues.length === 0, warnings: [], blockingIssues };
    },
    async preparePayload(manifest) {
      return {
        title: manifest.pageIdentity.title,
        slug: manifest.pageIdentity.slug,
        status: manifest.publicationMode === "PUBLISH_NOW" ? "publish" : "draft",
        content: manifest.contentPayloadReference,
        excerpt: manifest.metadataPayload.excerpt,
        featuredMediaId: manifest.mediaManifest.featuredMediaId,
        categories: manifest.metadataPayload.categories,
        tags: manifest.metadataPayload.tags,
        author: manifest.metadataPayload.author,
        seo: manifest.seoPayload,
        canonical: manifest.canonicalInstructions,
        openGraph: manifest.openGraphData,
        structuredData: manifest.structuredDataPayload,
        customFields: manifest.metadataPayload.customFields,
      };
    },
    async publish(destination, manifest) {
      const payload = await this.preparePayload(manifest);
      return transport.upsertContent({ destination, payload });
    },
    async update(destination, manifest, remoteObjectId) {
      const payload = await this.preparePayload(manifest);
      return transport.upsertContent({ destination, payload, remoteObjectId });
    },
    async schedule(destination, manifest, scheduleAtIso) {
      const payload = await this.preparePayload(manifest);
      return transport.upsertContent({ destination, payload, scheduleAtIso });
    },
    async archive() {
      return { success: true };
    },
    async delete() {
      return { success: true };
    },
    async rollback() {
      return { success: true };
    },
    async verify(destination, remoteObjectId) {
      const remote = await transport.getRemoteState({ destination, remoteObjectId });
      return { available: Boolean(remote), remoteState: remote ?? {} };
    },
    async fetchRemoteState(destination, remoteObjectId) {
      return transport.getRemoteState({ destination, remoteObjectId });
    },
  };
}

export function resolveDestinationAdapter(input: {
  destinationType: string;
  wordpressAdapter?: GmpDestinationAdapter;
  fallbackAdapter?: GmpDestinationAdapter;
}): GmpDestinationAdapter {
  if (input.destinationType === "WORDPRESS" && input.wordpressAdapter) {
    return input.wordpressAdapter;
  }
  return input.fallbackAdapter ?? createMockPublishingAdapter();
}
