import { createHash } from "node:crypto";

export const SAN_ANTONIO_NATIVE_REPAIR_OPERATION = "REPAIR_SAN_ANTONIO_NATIVE_WORDPRESS_RENDER" as const;
export const SAN_ANTONIO_NATIVE_REPAIR_OBJECT_ID = "13103" as const;
export const SAN_ANTONIO_NATIVE_REPAIR_BEFORE_HASH = "a61f1268c93b269f82fbd6904f437c1b90429cc11efef8f30428842de3caca31" as const;
export const SAN_ANTONIO_NATIVE_SHELL_CONTRACT = "GENESIS_OWNS_PRIMARY_PAGE_PRESENTATION_V1" as const;

export const hashSanAntonioNativeRender = (value: string) => createHash("sha256").update(value).digest("hex");

const REPAIR_CSS = `body.page-id-13103 .page-title.the-title,body.page-id-13103 .post-media.single-image{display:none!important}body.page-id-13103 .saw{width:100%;max-width:none;min-width:0;overflow-x:clip}body.page-id-13103 .saw-product,body.page-id-13103 .saw-split{width:100%;min-width:0}body.page-id-13103 .saw-product{grid-template-columns:minmax(0,1.1fr) minmax(22rem,.9fr)}body.page-id-13103 .saw-product>*,body.page-id-13103 .saw-split>*,body.page-id-13103 .saw-product-copy,body.page-id-13103 .saw-split-copy{min-width:0;max-width:none}body.page-id-13103 .saw h1,body.page-id-13103 .saw h2,body.page-id-13103 .saw h3{word-break:normal;overflow-wrap:normal;hyphens:none;white-space:normal}body.page-id-13103 .saw-product img{width:100%;height:auto;aspect-ratio:20/9;object-fit:contain}@media(max-width:800px){body.page-id-13103 .saw-product,body.page-id-13103 .saw-split{grid-template-columns:minmax(0,1fr)}body.page-id-13103 .saw-product-copy,body.page-id-13103 .saw-split-copy{width:100%}body.page-id-13103 .saw-guide,body.page-id-13103 .saw-links,body.page-id-13103 .saw-facts{min-width:0;max-width:100%}body.page-id-13103 .saw-guide a,body.page-id-13103 .saw-links span{overflow-wrap:anywhere}}`;

export function repairSanAntonioNativeWordPressHtml(input: string): string {
  const raw = input.trim();
  if (hashSanAntonioNativeRender(raw) !== SAN_ANTONIO_NATIVE_REPAIR_BEFORE_HASH) throw new Error("SAN_ANTONIO_NATIVE_REPAIR_SOURCE_DRIFT");
  if (!raw.includes('data-wordpress-authority="POST_CONTENT"') || !raw.includes('data-product-authority-balance="55_45"') || !raw.includes("WordPress media 10757") || (raw.match(/<h1\b/gi) ?? []).length !== 1) throw new Error("SAN_ANTONIO_NATIVE_REPAIR_CONTRACT_MISSING");
  const withContract = raw.replace('<main class="saw" data-genesis-primary-content', `<main class="saw" data-genesis-primary-content data-genesis-owns-primary-page-presentation="true" data-genesis-shell-contract="${SAN_ANTONIO_NATIVE_SHELL_CONTRACT}"`);
  const withSections = withContract.replace('<section class="saw-product"', '<section id="product-authority" class="saw-product"').replace('<section class="saw-split"', '<section id="contextual-in-use" class="saw-split"');
  const repaired = withSections.replace("</style><main", `${REPAIR_CSS}</style><main`);
  if (repaired === raw || (repaired.match(/<h1\b/gi) ?? []).length !== 1) throw new Error("SAN_ANTONIO_NATIVE_REPAIR_TRANSFORM_FAILED");
  return repaired;
}

export function evaluateSanAntonioNativeRepairContract(html: string) {
  const required = [
    'data-genesis-owns-primary-page-presentation="true"',
    `data-genesis-shell-contract="${SAN_ANTONIO_NATIVE_SHELL_CONTRACT}"`,
    "body.page-id-13103 .page-title.the-title",
    "body.page-id-13103 .post-media.single-image",
    "grid-template-columns:minmax(0,1.1fr) minmax(22rem,.9fr)",
    "grid-template-columns:minmax(0,1fr)",
    "min-width:0",
    "word-break:normal",
    "hyphens:none",
    'id="product-authority"',
    'id="contextual-in-use"',
  ];
  return { state: required.every((value) => html.includes(value)) && (html.match(/<h1\b/gi) ?? []).length === 1 ? "PASS" as const : "FAIL" as const, missing: required.filter((value) => !html.includes(value)) };
}