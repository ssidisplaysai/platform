import { createHash } from "node:crypto";

export const SAN_ANTONIO_HERO_CONTRAST_OPERATION = "REPAIR_SAN_ANTONIO_HERO_CONTRAST" as const;
export const SAN_ANTONIO_HERO_CONTRAST_BEFORE_HASH = "98310d967361e3db57c18a782cbe2340e46552f73a9624a8f182b4c6055b2128" as const;
export const SAN_ANTONIO_HERO_CONTRAST_CONTRACT = "SAN_ANTONIO_HERO_CONTRAST_VISUAL_REPAIR_V1" as const;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const HERO_CONTRAST_CSS = `body.page-id-13103 .saw-hero .saw-kicker{color:#f2b84b!important}body.page-id-13103 .saw-hero h1{color:#fff!important}body.page-id-13103 .saw-hero .saw-copy{color:#f5f7f7!important}body.page-id-13103 .saw-hero .saw-button:not(.alt){background:#f2b84b!important;color:#172022!important}body.page-id-13103 .saw-hero .saw-button.alt{background:transparent!important;border-color:#fff!important;color:#fff!important}body.page-id-13103 .saw-hero .saw-note{color:#d7dddd!important;opacity:1}`;

export function repairSanAntonioHeroContrast(input: string) {
  const raw = input.trim(); if (hash(raw) !== SAN_ANTONIO_HERO_CONTRAST_BEFORE_HASH) throw new Error("SAN_ANTONIO_HERO_CONTRAST_SOURCE_DRIFT");
  if (!raw.includes('data-genesis-owns-primary-page-presentation="true"') || !raw.includes("linear-gradient(90deg,rgba(17,22,23,.96),rgba(17,22,23,.78) 48%,rgba(17,22,23,.28))") || (raw.match(/<h1\b/gi) ?? []).length !== 1) throw new Error("SAN_ANTONIO_HERO_CONTRAST_AUTHORITY_MISSING");
  const repaired = raw.replace("</style><main", `${HERO_CONTRAST_CSS}</style><main`).replace('data-genesis-shell-contract="GENESIS_OWNS_PRIMARY_PAGE_PRESENTATION_V1"', `data-genesis-shell-contract="GENESIS_OWNS_PRIMARY_PAGE_PRESENTATION_V1" data-hero-contrast-contract="${SAN_ANTONIO_HERO_CONTRAST_CONTRACT}"`);
  if (repaired === raw || (repaired.match(/<h1\b/gi) ?? []).length !== 1) throw new Error("SAN_ANTONIO_HERO_CONTRAST_TRANSFORM_FAILED");
  return repaired;
}

export function evaluateSanAntonioHeroContrastContract(html: string) {
  const required = [SAN_ANTONIO_HERO_CONTRAST_CONTRACT, ".saw-hero h1{color:#fff!important}", ".saw-hero .saw-kicker{color:#f2b84b!important}", ".saw-hero .saw-copy{color:#f5f7f7!important}", ".saw-hero .saw-button:not(.alt){background:#f2b84b!important;color:#172022!important}", ".saw-hero .saw-button.alt{background:transparent!important;border-color:#fff!important;color:#fff!important}", ".saw-hero .saw-note{color:#d7dddd!important;opacity:1}"];
  return { state: required.every((value) => html.includes(value)) ? "PASS" as const : "FAIL" as const, missing: required.filter((value) => !html.includes(value)) };
}