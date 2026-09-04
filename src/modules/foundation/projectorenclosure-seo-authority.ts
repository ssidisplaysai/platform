import "server-only";

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import type { GlwPageType } from "@/modules/glw/page-generation";

const WORKBOOK_FILE_NAME = "Projector_Enclosure_Master_Keyword_Universe.xlsx";
const WORKBOOK_RESOURCE_PATH = `resources/seo-authority/projectorenclosure/${WORKBOOK_FILE_NAME}`;
const WORKBOOK_PATH = resolve(process.cwd(), WORKBOOK_RESOURCE_PATH);

const REQUIRED_SHEETS = [
  "Master Keywords",
  "Projection Mapping",
  "Projector Compatibility",
  "Electrical & Voltage",
  "State Expansion",
  "City Expansion",
  "Close Variants",
  "Page Mapping",
  "Sources",
] as const;

export type ProjectorEnclosureSeoKeyword = {
  masterId: string;
  keyword: string;
  cluster: string;
  sourcePass: string;
  intent: string;
  buyerStage: string;
  pageTarget: string;
  closeVariantKey: string;
  sourceSheet: string;
  sourceRow: number;
};

export type ProjectorEnclosureGeographicKeyword = {
  keyword: string;
  city: string | null;
  state: string;
  abbreviation: string | null;
  template: string;
  intent: string;
  pageRecommendation: string;
  sourceSheet: "State Expansion" | "City Expansion";
  sourceRow: number;
};

export type ProjectorEnclosurePageMapping = {
  pageTarget: string;
  keywordCount: number;
  recommendedRole: string;
  status: string;
  siteStudioPageType: GlwPageType | null;
  sourceRow: number;
};

export type ProjectorEnclosureSeoProvenance = {
  fileName: string;
  sha256: string;
  sourcePath: string;
  sheets: readonly string[];
};

export type ProjectorEnclosureKeywordOwner = {
  canonicalUrl: string;
  primaryKeyword: string;
  pageTarget: string;
  closeVariantKey?: string | null;
};

export type ProjectorEnclosureSeoRequestContext = {
  baseKeyword: string;
  pageTarget: string;
};

export type ProjectorEnclosureSeoSelectionContext = ProjectorEnclosureSeoRequestContext & {
  geographyValidated?: boolean;
  verifiedSecondaryKeywords?: readonly string[];
  verifiedCompatibilityKeywords?: readonly string[];
  verifiedElectricalKeywords?: readonly string[];
  existingOwners: readonly ProjectorEnclosureKeywordOwner[];
};

export type ProjectorEnclosureSeoSelection = {
  eligible: boolean;
  primaryKeyword: ProjectorEnclosureSeoKeyword | ProjectorEnclosureGeographicKeyword | null;
  secondaryKeywords: readonly ProjectorEnclosureSeoKeyword[];
  pageTarget: string;
  recommendedRole: string | null;
  intent: string | null;
  buyerStage: string | null;
  geographicVariant: ProjectorEnclosureGeographicKeyword | null;
  relatedPageTargets: readonly string[];
  selectionRationale: string;
  cannibalization: {
    passed: boolean;
    conflictingCanonicalUrl: string | null;
  };
  provenance: ProjectorEnclosureSeoProvenance;
};

type WorkbookRow = Record<string, string | number> & { sourceRow: number };

const PAGE_TYPE_BY_TARGET: Readonly<Record<string, GlwPageType | null>> = {
  "General Projector Enclosures": "general_service",
  "Projection Mapping": "general_service",
  "Outdoor Enclosures": "general_service",
  "Climate-Controlled Enclosures": "general_service",
  "Security Enclosures": "general_service",
  "Electrical Specifications": "general_service",
  "Hush Boxes": "general_service",
  "Resource / Guide": "general_service",
  "Compatibility / Model": "general_service",
};

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[\s_-]+/g, " ");
}

function numericId(value: string): number {
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function readRows(workbook: XLSX.WorkBook, sheetName: string): WorkbookRow[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`ProjectorEnclosure SEO authority is missing sheet: ${sheetName}.`);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { range: 3, defval: "", raw: false });
  return rows.map((row, index) => ({
    ...Object.fromEntries(Object.entries(row).map(([key, value]) => [key, String(value ?? "").trim()])),
    sourceRow: index + 5,
  }));
}

function keywordFromRow(row: WorkbookRow, sourceSheet: string): ProjectorEnclosureSeoKeyword {
  return {
    masterId: String(row["Master ID"]),
    keyword: String(row.Keyword),
    cluster: String(row.Cluster),
    sourcePass: String(row["Source Pass"]),
    intent: String(row.Intent),
    buyerStage: String(row["Buyer Stage"]),
    pageTarget: String(row["Page Target"]),
    closeVariantKey: String(row["Close Variant Key"]),
    sourceSheet,
    sourceRow: row.sourceRow,
  };
}

function geographyFromRow(row: WorkbookRow, sourceSheet: "State Expansion" | "City Expansion"): ProjectorEnclosureGeographicKeyword {
  return {
    keyword: String(row.Keyword),
    city: sourceSheet === "City Expansion" ? String(row.City) : null,
    state: String(row.State),
    abbreviation: sourceSheet === "State Expansion" ? String(row.Abbreviation) : null,
    template: String(row.Template),
    intent: String(row.Intent),
    pageRecommendation: String(row["Page Recommendation"]),
    sourceSheet,
    sourceRow: row.sourceRow,
  };
}

export class ProjectorEnclosureSeoAuthority {
  readonly provenance: ProjectorEnclosureSeoProvenance;
  readonly keywords: readonly ProjectorEnclosureSeoKeyword[];
  readonly projectionMappingKeywords: readonly ProjectorEnclosureSeoKeyword[];
  readonly compatibilityKeywords: readonly ProjectorEnclosureSeoKeyword[];
  readonly electricalKeywords: readonly ProjectorEnclosureSeoKeyword[];
  readonly stateKeywords: readonly ProjectorEnclosureGeographicKeyword[];
  readonly cityKeywords: readonly ProjectorEnclosureGeographicKeyword[];
  readonly pageMappings: readonly ProjectorEnclosurePageMapping[];
  readonly sourceCount: number;

  private readonly closeVariants: readonly WorkbookRow[];
  private readonly exactKeywords: ReadonlyMap<string, ProjectorEnclosureSeoKeyword>;

  constructor(buffer: Buffer, sourcePath = WORKBOOK_RESOURCE_PATH) {
    const workbook = XLSX.read(buffer, { type: "buffer", raw: false });
    for (const sheet of REQUIRED_SHEETS) {
      if (!workbook.SheetNames.includes(sheet)) throw new Error(`ProjectorEnclosure SEO authority is missing sheet: ${sheet}.`);
    }

    this.provenance = {
      fileName: WORKBOOK_FILE_NAME,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      sourcePath,
      sheets: REQUIRED_SHEETS,
    };
    this.keywords = readRows(workbook, "Master Keywords").map((row) => keywordFromRow(row, "Master Keywords"));
    if (this.keywords.some((keyword) => !keyword.masterId || !keyword.keyword || !keyword.cluster || !keyword.intent || !keyword.buyerStage || !keyword.pageTarget)) {
      throw new Error("ProjectorEnclosure SEO authority contains an incomplete master keyword record.");
    }
    const normalizedKeywords = this.keywords.map((keyword) => normalize(keyword.keyword));
    if (new Set(normalizedKeywords).size !== normalizedKeywords.length) {
      throw new Error("ProjectorEnclosure SEO authority contains normalized duplicate master keywords.");
    }
    this.projectionMappingKeywords = readRows(workbook, "Projection Mapping").map((row) => keywordFromRow(row, "Projection Mapping"));
    this.compatibilityKeywords = readRows(workbook, "Projector Compatibility").map((row) => keywordFromRow(row, "Projector Compatibility"));
    this.electricalKeywords = readRows(workbook, "Electrical & Voltage").map((row) => keywordFromRow(row, "Electrical & Voltage"));
    this.stateKeywords = readRows(workbook, "State Expansion").map((row) => geographyFromRow(row, "State Expansion"));
    this.cityKeywords = readRows(workbook, "City Expansion").map((row) => geographyFromRow(row, "City Expansion"));
    this.closeVariants = readRows(workbook, "Close Variants");
    this.pageMappings = readRows(workbook, "Page Mapping").map((row) => ({
      pageTarget: String(row["Page Target"]),
      keywordCount: Number(String(row["Keyword Count"]).replace(/,/g, "")),
      recommendedRole: String(row["Recommended Role"]),
      status: String(row.Status),
      siteStudioPageType: PAGE_TYPE_BY_TARGET[String(row["Page Target"])] ?? null,
      sourceRow: row.sourceRow,
    }));
    this.sourceCount = readRows(workbook, "Sources").length;
    this.exactKeywords = new Map(this.keywords.map((keyword) => [normalize(keyword.keyword), keyword]));
  }

  findExactKeyword(keyword: string): ProjectorEnclosureSeoKeyword | null {
    return this.exactKeywords.get(normalize(keyword)) ?? null;
  }

  findCluster(cluster: string): readonly ProjectorEnclosureSeoKeyword[] {
    const key = normalize(cluster);
    return this.keywords.filter((keyword) => normalize(keyword.cluster) === key)
      .sort((left, right) => numericId(left.masterId) - numericId(right.masterId));
  }

  findCloseVariants(keyword: string): readonly string[] {
    const key = normalize(keyword);
    const group = this.closeVariants.find((row) =>
      normalize(String(row["Primary Keyword"])) === key || normalize(String(row["Variant Keyword"])) === key,
    )?.["Group ID"];
    if (!group) return [];
    const values = this.closeVariants.filter((row) => row["Group ID"] === group)
      .flatMap((row) => [String(row["Primary Keyword"]), String(row["Variant Keyword"])]);
    return [...new Map(values.filter(Boolean).map((value) => [normalize(value), value])).values()];
  }

  findState(state: string): readonly ProjectorEnclosureGeographicKeyword[] {
    const key = normalize(state);
    return this.stateKeywords.filter((record) => normalize(record.state) === key || normalize(record.abbreviation) === key);
  }

  findCity(city: string, state: string): readonly ProjectorEnclosureGeographicKeyword[] {
    const cityKey = normalize(city);
    const stateKey = normalize(state);
    return this.cityKeywords.filter((record) => normalize(record.city) === cityKey && normalize(record.state) === stateKey);
  }

  compatibilityEligibility(keyword: string, verifiedCompatibilityKeywords: readonly string[]): boolean {
    const candidate = this.compatibilityKeywords.find((record) => normalize(record.keyword) === normalize(keyword));
    return Boolean(candidate && verifiedCompatibilityKeywords.some((verified) => normalize(verified) === normalize(keyword)));
  }

  electricalEligibility(keyword: string, verifiedElectricalKeywords: readonly string[]): boolean {
    const candidate = this.electricalKeywords.find((record) => normalize(record.keyword) === normalize(keyword));
    return Boolean(candidate && verifiedElectricalKeywords.some((verified) => normalize(verified) === normalize(keyword)));
  }

  select(input: ProjectorEnclosureSeoSelectionContext & {
    canonicalUrl: string;
    pageType: GlwPageType;
    city?: string | null;
    state?: string | null;
    secondaryLimit?: number;
  }): ProjectorEnclosureSeoSelection {
    const mapping = this.pageMappings.find((entry) => normalize(entry.pageTarget) === normalize(input.pageTarget));
    const base = this.findExactKeyword(input.baseKeyword);
    const pageTypeCompatible = input.pageType === "general_service"
      ? mapping?.siteStudioPageType === "general_service"
      : normalize(input.pageTarget) === normalize("General Projector Enclosures");
    let primary: ProjectorEnclosureSeoSelection["primaryKeyword"] = base;
    let geographicVariant: ProjectorEnclosureGeographicKeyword | null = null;
    let rationale = "Exact workbook keyword and page-target compatibility confirmed.";
    let canonicalUrlValid = false;
    try {
      canonicalUrlValid = new URL(input.canonicalUrl).protocol === "https:";
    } catch {
      canonicalUrlValid = false;
    }

    if (!canonicalUrlValid) {
      primary = null;
      rationale = "An exact HTTPS canonical target is required before keyword selection.";
    } else if (!base || normalize(base.pageTarget) !== normalize(input.pageTarget) || !pageTypeCompatible) {
      primary = null;
      rationale = "No exact keyword with a supported Site Studio page-role mapping was available.";
    }

    if (primary && (input.pageType === "city_service" || input.pageType === "state_service")) {
      if (!input.geographyValidated) {
        primary = null;
        rationale = "Geographic keyword is not eligible until the location page is validated.";
      } else {
        const candidates = input.pageType === "city_service"
          ? this.findCity(input.city ?? "", input.state ?? "")
          : this.findState(input.state ?? "");
        geographicVariant = candidates.find((candidate) => normalize(candidate.template) === normalize("projector enclosure")) ?? null;
        primary = geographicVariant;
        rationale = geographicVariant
          ? "Validated location target uses the workbook's controlled projector-enclosure geography template."
          : "No exact controlled geographic keyword exists for the validated location.";
      }
    }

    if (primary && normalize(input.pageTarget) === normalize("Compatibility / Model")
      && !this.compatibilityEligibility(primary.keyword, input.verifiedCompatibilityKeywords ?? [])) {
      primary = null;
      rationale = "Compatibility keyword is not eligible without separately verified product compatibility.";
    }
    if (primary && normalize(input.pageTarget) === normalize("Electrical Specifications")
      && !this.electricalEligibility(primary.keyword, input.verifiedElectricalKeywords ?? [])) {
      primary = null;
      rationale = "Electrical keyword is not eligible without an exact authoritative product specification.";
    }

    const owners = input.existingOwners;
    const conflict = primary ? owners.find((owner) => owner.canonicalUrl !== input.canonicalUrl && (
      normalize(owner.primaryKeyword) === normalize(primary?.keyword)
      || Boolean(!geographicVariant && base?.closeVariantKey && normalize(owner.closeVariantKey) === normalize(base.closeVariantKey))
    )) : null;
    if (conflict) {
      primary = null;
      rationale = `Primary keyword is already owned by ${conflict.canonicalUrl}.`;
    }

    const secondaryLimit = Math.max(0, Math.min(input.secondaryLimit ?? 4, 10));
    const closeVariantKeys = new Set(this.findCloseVariants(input.baseKeyword).map(normalize));
    const verifiedSecondaryKeys = new Set((input.verifiedSecondaryKeywords ?? []).map(normalize));
    const secondaryPool = base ? [
      ...(geographicVariant ? [base] : []),
      ...this.keywords.filter((candidate) => candidate.masterId !== base.masterId),
    ] : [];
    const secondary = secondaryPool
      .filter((candidate) => normalize(candidate.pageTarget) === normalize(input.pageTarget))
      .filter((candidate) => closeVariantKeys.has(normalize(candidate.keyword)) || verifiedSecondaryKeys.has(normalize(candidate.keyword)) || candidate.masterId === base?.masterId)
      .filter((candidate) => !owners.some((owner) => owner.canonicalUrl !== input.canonicalUrl && normalize(owner.primaryKeyword) === normalize(candidate.keyword)))
      .slice(0, secondaryLimit);
    const relatedPageTargets = base ? [...new Set(this.findCluster(base.cluster)
      .map((keyword) => keyword.pageTarget)
      .filter((pageTarget) => normalize(pageTarget) !== normalize(input.pageTarget)))] : [];

    return {
      eligible: Boolean(primary),
      primaryKeyword: primary,
      secondaryKeywords: secondary,
      pageTarget: input.pageTarget,
      recommendedRole: mapping?.recommendedRole ?? null,
      intent: primary?.intent ?? base?.intent ?? null,
      buyerStage: "buyerStage" in (primary ?? {}) ? (primary as ProjectorEnclosureSeoKeyword).buyerStage : base?.buyerStage ?? null,
      geographicVariant,
      relatedPageTargets,
      selectionRationale: rationale,
      cannibalization: {
        passed: !conflict,
        conflictingCanonicalUrl: conflict?.canonicalUrl ?? null,
      },
      provenance: this.provenance,
    };
  }
}

let defaultAuthority: ProjectorEnclosureSeoAuthority | null = null;

export function loadProjectorEnclosureSeoAuthority(): ProjectorEnclosureSeoAuthority {
  defaultAuthority ??= new ProjectorEnclosureSeoAuthority(readFileSync(WORKBOOK_PATH), WORKBOOK_RESOURCE_PATH);
  return defaultAuthority;
}
