import { evaluateProductReadiness } from "./product-readiness";
import type { PermissionAction, ProductConfiguration } from "./types";

export function evaluateProductPublishingGuard(input: {
  product: ProductConfiguration;
  permissions: Set<PermissionAction>;
}): {
  allowed: boolean;
  reasons: readonly string[];
} {
  const readiness = evaluateProductReadiness({
    product: input.product,
    permissions: input.permissions,
    requiredPermission: "products:evaluate_readiness",
  });

  return {
    allowed: readiness.ready,
    reasons: readiness.blockingReasons,
  };
}
