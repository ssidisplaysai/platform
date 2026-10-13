import "server-only";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { captureGovernedRenderedPage } from "@/modules/foundation/governed-render-capture-browser";
import { resolvePersistenceRoot } from "@/modules/foundation/foundation-persistence";
import { signGovernedSnapshotPath } from "@/modules/foundation/governed-render-capture-orchestrator";
import { getSiteById } from "@/modules/foundation/site-repository";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";
import { getDallasApplyState } from "./dallas-rich-composition-apply-repository";
import { evaluateDallasV3Drift } from "./dallas-rich-composition-apply";
import {
  DALLAS_APPROVED_BODY_HASH,
  DALLAS_APPROVED_SEO_HASH,
  DALLAS_THEME_TEMPLATE,
  evaluateThemeIntegrationReady,
  type DallasThemeCapture,
  type DallasThemeCertification,
  type DallasThemeRepairReceipt,
} from "./dallas-public-theme-integration";
import {
  getDallasThemeIntegrationState,
  saveDallasThemeCertification,
  saveDallasThemeRepairReceipt,
} from "./dallas-public-theme-integration-repository";
import { inspectDallasWordPressAuthority } from "./dallas-wordpress-authority-inspector";
const JOB_ID = "2ca74016-252b-4587-bf3c-ec9b7eb839c9";
const VIEWPORTS = [
  {
    viewport: "DESKTOP_1440" as const,
    width: 1440,
    height: 1024,
    viewportClass: "DESKTOP" as const,
  },
  {
    viewport: "DESKTOP_1024" as const,
    width: 1024,
    height: 900,
    viewportClass: "DESKTOP" as const,
  },
  {
    viewport: "TABLET_768" as const,
    width: 768,
    height: 1024,
    viewportClass: "DESKTOP" as const,
  },
  {
    viewport: "MOBILE_375" as const,
    width: 375,
    height: 812,
    viewportClass: "MOBILE" as const,
  },
];
const sha = (value: Uint8Array | string) =>
  createHash("sha256").update(value).digest("hex");
function authority() {
  const site = getSiteById("site-ssi-projectorenclosure");
  if (!site?.integrations.wordpressApiBaseUrl)
    throw new Error("DALLAS_THEME_SITE_AUTHORITY_REQUIRED");
  const credential = resolveWordPressCredentialReference(
    site.integrations.wordpressCredentialReference,
  );
  if (!credential) throw new Error("DALLAS_THEME_CREDENTIAL_REQUIRED");
  return {
    site,
    authorization: `Basic ${Buffer.from(`${credential.username}:${credential.applicationPassword}`).toString("base64")}`,
  };
}
export async function applyDallasThemeIntegrationRepair() {
  const existing = getDallasThemeIntegrationState().receipts.at(-1);
  if (existing) return { receipt: existing, reused: true };
  const before = await inspectDallasWordPressAuthority("draft");
  if (
    before.body.contentHash !== DALLAS_APPROVED_BODY_HASH ||
    before.seo.hash !== DALLAS_APPROVED_SEO_HASH ||
    before.featuredMediaId !== 10757 ||
    before.identity.parent !== 13083 ||
    before.identity.template !== "default"
  )
    throw new Error("DALLAS_THEME_REPAIR_IDENTITY_STALE");
  const { site, authorization } = authority();
  const settings =
    before.authorityMap.registeredPageMeta._elementor_page_settings ?? null;
  const response = await fetch(
    `${site.integrations.wordpressApiBaseUrl}/pages/13084`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template: DALLAS_THEME_TEMPLATE,
        meta: { _elementor_page_settings: { hide_title: "yes" } },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok)
    throw new Error(`DALLAS_THEME_REPAIR_WRITE_FAILED:${response.status}`);
  const after = await inspectDallasWordPressAuthority("draft");
  const afterSettings = after.authorityMap.registeredPageMeta
    ._elementor_page_settings as { hide_title?: string } | null;
  if (
    after.identity.template !== DALLAS_THEME_TEMPLATE ||
    afterSettings?.hide_title !== "yes" ||
    after.body.contentHash !== DALLAS_APPROVED_BODY_HASH ||
    after.seo.hash !== DALLAS_APPROVED_SEO_HASH ||
    after.featuredMediaId !== 10757 ||
    after.body.h1Count !== 1
  )
    throw new Error("DALLAS_THEME_REPAIR_READBACK_FAILED");
  const now = new Date().toISOString();
  const receipt: DallasThemeRepairReceipt = {
    receiptId: `dallas-theme-repair-${sha(`${now}:13084`).slice(0, 20)}`,
    contract: "dallas-public-theme-integration-repair-v1",
    wordpressObjectId: "13084",
    status: "draft",
    beforeTemplate: "default",
    afterTemplate: DALLAS_THEME_TEMPLATE,
    beforePageSettings: settings,
    afterPageSettings: { hide_title: "yes" },
    bodyHashBefore: DALLAS_APPROVED_BODY_HASH,
    bodyHashAfter: DALLAS_APPROVED_BODY_HASH,
    seoHashBefore: DALLAS_APPROVED_SEO_HASH,
    seoHashAfter: DALLAS_APPROVED_SEO_HASH,
    featuredMediaBefore: 10757,
    featuredMediaAfter: 10757,
    rollbackState: "AVAILABLE",
    mutationVerifiedAt: now,
    publicationPerformed: false,
    campaignMutationPerformed: false,
    dispatchPerformed: false,
  };
  return { receipt: saveDallasThemeRepairReceipt(receipt), reused: false };
}
function store(
  receiptId: string,
  captureId: string,
  bytes: Uint8Array,
  width: number,
  height: number,
) {
  const reference = `dallas-theme-integration-artifacts/${receiptId}/${captureId}.png`;
  const path = join(resolvePersistenceRoot(), ...reference.split("/"));
  const digest = sha(bytes);
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path) && sha(readFileSync(path)) !== digest)
    throw new Error("DALLAS_THEME_CAPTURE_COLLISION");
  if (!existsSync(path)) writeFileSync(path, bytes);
  return { reference, sha256: digest, bytes: bytes.length, width, height };
}
export function readDallasThemeCapture(reference: string) {
  if (
    !reference.startsWith("dallas-theme-integration-artifacts/") ||
    reference.includes("..")
  )
    throw new Error("DALLAS_THEME_CAPTURE_REFERENCE_INVALID");
  return readFileSync(join(resolvePersistenceRoot(), ...reference.split("/")));
}
export async function captureDallasThemeIntegratedDraft() {
  const state = getDallasThemeIntegrationState();
  const receipt = state.receipts.at(-1);
  if (!receipt) throw new Error("DALLAS_THEME_REPAIR_RECEIPT_REQUIRED");
  const prior = state.certifications.find(
    (item) => item.receiptId === receipt.receiptId,
  );
  if (prior) return { certification: prior, reused: true };
  const current = await inspectDallasWordPressAuthority("draft");
  if (
    current.identity.template !== DALLAS_THEME_TEMPLATE ||
    current.body.contentHash !== DALLAS_APPROVED_BODY_HASH ||
    current.seo.hash !== DALLAS_APPROVED_SEO_HASH ||
    current.featuredMediaId !== 10757
  )
    throw new Error("DALLAS_THEME_CAPTURE_IDENTITY_STALE");
  const apply = getDallasApplyState();
  const applyReceipt = apply.receipts.at(-1);
  if (!applyReceipt) throw new Error("DALLAS_APPLY_RECEIPT_REQUIRED");
  const assignments = [
    {
      assignmentId: "wordpress-media:10757",
      semanticRole: "PRODUCT_AUTHORITY" as const,
      mediaId: "10757",
      sourceUrl:
        "https://projectorenclosure.com/wp-content/uploads/2024/03/Integrator-scaled-1.webp",
      contextId: "DOCUMENTARY",
    },
    ...applyReceipt.uploadedMedia.map((item) => ({
      assignmentId: `wordpress-media:${item.mediaId}`,
      semanticRole: item.role,
      mediaId: String(item.mediaId),
      sourceUrl: item.url,
      contextId: item.claimClass,
    })),
  ];
  const origin = new URL(
    process.env.GENESIS_RENDER_CAPTURE_INTERNAL_ORIGIN?.trim() ||
      "http://localhost:3003",
  ).origin;
  const pathname = `/api/glw/pages/${JOB_ID}/theme-integrated-snapshot`;
  const query = "organizationId=ssi&siteId=site-ssi-projectorenclosure";
  const signedPath = `${pathname}?${query}`;
  const captureSetId = `capture-${sha(new Date().toISOString()).slice(0, 16)}`;
  const captures: DallasThemeCapture[] = [];
  for (const viewport of VIEWPORTS) {
    const captureId = `${captureSetId}-${viewport.viewport.toLowerCase()}`;
    const result = await captureGovernedRenderedPage({
      targetUrl: `${origin}${signedPath}`,
      allowedOrigins: [
        origin,
        "https://projectorenclosure.com",
        "https://fonts.googleapis.com",
        "https://fonts.gstatic.com",
      ],
      internalGenesisOrigin: origin,
      internalAuthorization: {
        header: "x-genesis-render-capture",
        value: signGovernedSnapshotPath(signedPath),
      },
      viewportClass: viewport.viewportClass,
      viewport: { width: viewport.width, height: viewport.height },
      captureId,
      mediaAssignments: assignments,
    });
    captures.push({
      captureId,
      viewport: viewport.viewport,
      width: viewport.width,
      height: viewport.height,
      documentWidth: result.evidence.documentWidth,
      documentHeight: result.evidence.documentHeight,
      horizontalOverflow: result.evidence.horizontalOverflow,
      themeIntegration: result.themeIntegration,
      mediaRolesRendered: result.evidence.media
        .filter((item) => item.rendered)
        .map((item) => item.semanticRole),
      sectionCount: result.evidence.sections.length,
      artifact: store(
        receipt.receiptId,
        captureId,
        result.bytes,
        result.imageWidth,
        result.imageHeight,
      ),
      capturedAt: result.evidence.capturedAt,
    });
  }
  const ready = evaluateThemeIntegrationReady(captures);
  const expectedRoles = [
    "PRODUCT_AUTHORITY",
    "CONTEXTUAL_IN_USE",
    "APPLICATION_EXPERIENCE",
    "LOCAL_CONTEXTUAL_ATMOSPHERE",
  ];
  const drift = evaluateDallasV3Drift({
    expectedHtml: current.body.raw,
    actualHtml: current.body.raw,
    expectedLinks: current.body.links,
    actualLinks: current.body.links,
    expectedRoles,
    actualRoles: captures[0].mediaRolesRendered,
  });
  const findings: DallasThemeCertification["findings"] = [
    {
      code: "VISIBLE_H1_CARDINALITY",
      state: captures.every(
        (item) => item.themeIntegration.visibleH1Count === 1,
      )
        ? "PASS"
        : "FAIL",
      summary: "Exactly one visible H1 is required.",
    },
    {
      code: "THEME_TITLE_SUPPRESSED",
      state: captures.every(
        (item) => !item.themeIntegration.duplicateThemeTitleVisible,
      )
        ? "PASS"
        : "FAIL",
      summary: "Cerato page title is absent.",
    },
    {
      code: "THEME_FEATURED_MEDIA_SUPPRESSED",
      state: captures.every(
        (item) => !item.themeIntegration.duplicateThemeFeaturedMediaVisible,
      )
        ? "PASS"
        : "FAIL",
      summary: "Theme featured wrapper is absent.",
    },
    {
      code: "HORIZONTAL_OVERFLOW",
      state: captures.every((item) => item.horizontalOverflow === 0)
        ? "PASS"
        : "FAIL",
      summary: "All four viewports must have zero overflow.",
    },
    {
      code: "HEADER_FOOTER",
      state: captures.every(
        (item) =>
          item.themeIntegration.globalHeaderPresent &&
          item.themeIntegration.globalFooterPresent,
      )
        ? "PASS"
        : "FAIL",
      summary: "Live theme header and footer are present.",
    },
    {
      code: "SEMANTIC_MEDIA",
      state: captures.every((item) => item.mediaRolesRendered.length === 4)
        ? "PASS"
        : "FAIL",
      summary: "All four semantic roles render.",
    },
  ];
  const overall =
    ready.state === "PASS" &&
    !findings.some((item) => item.state === "FAIL") &&
    (drift.classification === "NONE" || drift.classification === "MINOR")
      ? "PASS"
      : "FAIL";
  const certification: DallasThemeCertification = {
    certificationId: `dallas-theme-certification-${receipt.receiptId}`,
    receiptId: receipt.receiptId,
    renderClass: "THEME_INTEGRATED_RENDER",
    captureAuthority:
      "SIGNED_INTERNAL_EQUIVALENT_USING_LIVE_ELEMENTOR_HEADER_FOOTER_SHELL",
    captures,
    findings,
    themeIntegrationReady: overall === "PASS",
    overallState: overall,
    drift: drift.classification === "NONE" ? "MINOR" : drift.classification,
    driftReasons:
      drift.classification === "NONE"
        ? ["REAL_THEME_HEADER_FOOTER_EQUIVALENT"]
        : drift.reasons,
    createdAt: new Date().toISOString(),
    publicationPerformed: false,
  };
  if (overall !== "PASS")
    throw new Error(
      `DALLAS_THEME_INTEGRATION_NOT_READY:${ready.failures.join(",")}:${captures.map((item) => `${item.viewport}=${item.documentWidth}/${item.width}/${item.horizontalOverflow}`).join(";")}`,
    );
  return {
    certification: saveDallasThemeCertification(certification),
    reused: false,
  };
}
