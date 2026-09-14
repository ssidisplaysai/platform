import "server-only";

import { captureGenesisBackgroundAwareTextContrast } from "@/modules/foundation/background-aware-text-contrast-capture";
import { signGovernedSnapshotPath } from "@/modules/foundation/governed-render-capture-orchestrator";
import { getSanAntonioStagingState } from "./san-antonio-wordpress-staging-authority";
import { getSanAntonioHeroContrastState } from "./san-antonio-hero-contrast-repair-service";
import { getSanAntonioBackgroundAwareContrastState } from "./san-antonio-background-aware-contrast-update-service";

export async function captureSanAntonioBackgroundAwareContrast(version: "before" | "after") {
  const staging = getSanAntonioStagingState().receipts.at(-1); const hero = getSanAntonioHeroContrastState().receipts.at(-1); const systemic = getSanAntonioBackgroundAwareContrastState().receipts.at(-1); if (!staging || !hero || (version === "after" && !systemic)) throw new Error("SAN_ANTONIO_CONTRAST_AUTHORITY_REQUIRED");
  const origin = new URL(process.env.GENESIS_RENDER_CAPTURE_INTERNAL_ORIGIN?.trim() || "http://localhost:3003").origin; const pathname = "/api/glw/pages/f518ffb7-9216-4866-a93c-7f4793e74038/native-wordpress-render-snapshot"; const query = "organizationId=ssi&siteId=site-ssi-projectorenclosure"; const signedPath = `${pathname}?${query}`;
  const mediaAssignments = [{ assignmentId: "wordpress-media:10757", semanticRole: "PRODUCT_AUTHORITY" as const, mediaId: "10757", sourceUrl: "https://projectorenclosure.com/wp-content/uploads/2024/03/Integrator-scaled-1.webp", contextId: "DOCUMENTARY" }, ...staging.uploadedMedia.map((item) => ({ assignmentId: `wordpress-media:${item.mediaId}`, semanticRole: item.role as "CONTEXTUAL_IN_USE" | "APPLICATION_EXPERIENCE" | "LOCAL_CONTEXTUAL_ATMOSPHERE", mediaId: String(item.mediaId), sourceUrl: item.url, contextId: item.claimClass }))];
  return captureGenesisBackgroundAwareTextContrast({ certificationId: `san-antonio-background-aware-contrast-v1_1-${version}-${version === "after" ? systemic!.receiptId : hero.receiptId}`, identity: { organizationId: "ssi", siteId: "site-ssi-projectorenclosure", pageId: "13103", renderedContentHash: version === "after" ? systemic!.afterHash : hero.afterHash, authority: "HOST_RENDER" }, targetUrl: `${origin}${signedPath}`, allowedOrigins: [origin, "https://projectorenclosure.com", "https://fonts.googleapis.com", "https://fonts.gstatic.com"], internalGenesisOrigin: origin, internalAuthorization: { header: "x-genesis-render-capture", value: signGovernedSnapshotPath(signedPath) }, mediaAssignments });
}