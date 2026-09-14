import { createHash } from "node:crypto";
import { GENESIS_BACKGROUND_AWARE_TEXT_CONTRAST_CONTRACT, GENESIS_BACKGROUND_AWARE_TEXT_CONTRAST_CSS } from "@/modules/foundation/background-aware-text-contrast";

export const SAN_ANTONIO_SYSTEMIC_CONTRAST_OPERATION = "APPLY_BACKGROUND_AWARE_TEXT_CONTRAST" as const;
export const SAN_ANTONIO_SYSTEMIC_CONTRAST_BEFORE_HASH = "ce3dd9ca1ba02a64ae0d7e25f42c628d8e6159af84f3ee395659f92c8698cecb" as const;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export function applyBackgroundAwareContrastToSanAntonio(input: string) {
  const raw = input.trim(); if (hash(raw) !== SAN_ANTONIO_SYSTEMIC_CONTRAST_BEFORE_HASH) throw new Error("SAN_ANTONIO_SYSTEMIC_CONTRAST_SOURCE_DRIFT");
  let output = raw.replace("</style><main", `${GENESIS_BACKGROUND_AWARE_TEXT_CONTRAST_CSS}</style><main`);
  output = output.replace('<section class="saw-hero"', '<section data-genesis-background-type="IMAGE_WITH_DARK_OVERLAY" data-genesis-background-luminance="dark" class="saw-hero"');
  output = output.replace('<section id="product-authority" class="saw-product"', '<section id="product-authority" data-genesis-background-type="LIGHT_SOLID" data-genesis-background-luminance="light" class="saw-product"');
  output = output.replace('<section id="contextual-in-use" class="saw-split"', '<section id="contextual-in-use" data-genesis-background-type="DARK_SOLID" data-genesis-background-luminance="dark" class="saw-split"');
  output = output.replace('<section class="saw-application"', '<section data-genesis-background-type="IMAGE_WITH_DARK_OVERLAY" data-genesis-background-luminance="dark" class="saw-application"');
  output = output.replace('<section class="saw-section saw-cta"', '<section data-genesis-background-type="DARK_SOLID" data-genesis-background-luminance="dark" data-genesis-accent-treatment="light" class="saw-section saw-cta"');
  output = output.replaceAll('<section class="saw-section"', '<section data-genesis-background-type="LIGHT_SOLID" data-genesis-background-luminance="light" class="saw-section"');
  output = output.replace('data-hero-contrast-contract="SAN_ANTONIO_HERO_CONTRAST_VISUAL_REPAIR_V1"', `data-hero-contrast-contract="SAN_ANTONIO_HERO_CONTRAST_VISUAL_REPAIR_V1" data-background-aware-contrast-contract="${GENESIS_BACKGROUND_AWARE_TEXT_CONTRAST_CONTRACT}"`);
  if (output === raw || !output.includes(GENESIS_BACKGROUND_AWARE_TEXT_CONTRAST_CONTRACT)) throw new Error("SAN_ANTONIO_SYSTEMIC_CONTRAST_TRANSFORM_FAILED"); return output;
}

export function removeBackgroundAwareContrastFromSanAntonio(input: string) {
  return input
    .replace(GENESIS_BACKGROUND_AWARE_TEXT_CONTRAST_CSS, "")
    .replace(` data-background-aware-contrast-contract="${GENESIS_BACKGROUND_AWARE_TEXT_CONTRAST_CONTRACT}"`, "")
    .replace(/ data-genesis-background-type="[^"]+" data-genesis-background-luminance="[^"]+"(?: data-genesis-accent-treatment="[^"]+")?/g, "");
}