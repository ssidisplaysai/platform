import {
  createGlwCanonicalPath,
  getGlwCitiesForState,
  getGlwState,
  type GlwGenerationProduct,
} from "./page-generation";

export type GlwMatrixPlanAction =
  | "CREATE_STATE"
  | "CREATE_CITY"
  | "UPDATE_CITY"
  | "BLOCKED_DUPLICATE"
  | "BLOCKED_PARENT_STATE"
  | "NO_ACTION";

export type GlwExistingPage = {
  canonicalPath: string;
};

export type GlwPlannedPage = {
  action: GlwMatrixPlanAction;
  productId: string;
  stateCode: string;
  citySlug: string | null;
  canonicalPath: string;
  externalExecutionAllowed: false;
  reason: string;
};

export function planGlwPageMatrix(input: {
  products: readonly GlwGenerationProduct[];
  stateCodes: readonly string[];
  citySlugsByState: Readonly<Record<string, readonly string[]>>;
  existingPages: readonly GlwExistingPage[];
}): readonly GlwPlannedPage[] {
  const existingCount = new Map<string, number>();
  input.existingPages.forEach((page) => {
    existingCount.set(page.canonicalPath, (existingCount.get(page.canonicalPath) ?? 0) + 1);
  });

  const plans: GlwPlannedPage[] = [];
  input.products.forEach((product) => {
    input.stateCodes.forEach((stateCode) => {
      const state = getGlwState(stateCode);
      if (!state) return;

      const statePath = createGlwCanonicalPath({ productSlug: product.slug, stateCode });
      const stateCount = existingCount.get(statePath) ?? 0;

      if (stateCount > 1) {
        plans.push({ action: "BLOCKED_DUPLICATE", productId: product.productId, stateCode, citySlug: null, canonicalPath: statePath, externalExecutionAllowed: false, reason: "Multiple state pages share this canonical path." });
      } else if (stateCount === 0) {
        plans.push({ action: "CREATE_STATE", productId: product.productId, stateCode, citySlug: null, canonicalPath: statePath, externalExecutionAllowed: false, reason: `Create the ${state.name} parent page first.` });
      } else {
        plans.push({ action: "NO_ACTION", productId: product.productId, stateCode, citySlug: null, canonicalPath: statePath, externalExecutionAllowed: false, reason: `${state.name} parent page already exists.` });
      }

      const requestedCities = input.citySlugsByState[stateCode] ?? [];
      requestedCities.forEach((citySlug) => {
        const city = getGlwCitiesForState(stateCode).find((entry) => entry.slug === citySlug);
        if (!city) return;

        const cityPath = createGlwCanonicalPath({ productSlug: product.slug, stateCode, citySlug });
        const cityCount = existingCount.get(cityPath) ?? 0;

        if (stateCount !== 1) {
          plans.push({ action: "BLOCKED_PARENT_STATE", productId: product.productId, stateCode, citySlug, canonicalPath: cityPath, externalExecutionAllowed: false, reason: "Exactly one parent state page is required before city generation." });
        } else if (cityCount > 1) {
          plans.push({ action: "BLOCKED_DUPLICATE", productId: product.productId, stateCode, citySlug, canonicalPath: cityPath, externalExecutionAllowed: false, reason: "Multiple city pages share this canonical path." });
        } else if (cityCount === 0) {
          plans.push({ action: "CREATE_CITY", productId: product.productId, stateCode, citySlug, canonicalPath: cityPath, externalExecutionAllowed: false, reason: `Create the ${city.name} page.` });
        } else {
          plans.push({ action: "UPDATE_CITY", productId: product.productId, stateCode, citySlug, canonicalPath: cityPath, externalExecutionAllowed: false, reason: `Refresh the existing ${city.name} page.` });
        }
      });
    });
  });

  return plans;
}