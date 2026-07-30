import type {
  InventoryReorderEvaluation,
  InventoryStockRecord,
  InventoryStockStatus,
  ProductConfiguration,
} from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

export function isIntegerQuantity(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value);
}

export function calculateAvailableQuantity(stock: {
  onHandQuantity: number;
  reservedQuantity: number;
  allocatedQuantity: number;
  damagedQuantity: number;
  inspectionHoldQuantity: number;
}): number {
  return (
    stock.onHandQuantity -
    stock.reservedQuantity -
    stock.allocatedQuantity -
    stock.damagedQuantity -
    stock.inspectionHoldQuantity
  );
}

export function deriveStockStatus(input: {
  stock: InventoryStockRecord;
  product: ProductConfiguration;
}): InventoryStockStatus {
  if (input.product.lifecycleState === "archived") {
    return "discontinued";
  }

  if (input.product.lifecycleState === "suspended") {
    return "unavailable";
  }

  if (input.stock.backorderedQuantity > 0) {
    return "backordered";
  }

  if (input.stock.availableQuantity <= 0 && input.stock.incomingQuantity > 0) {
    return "incoming";
  }

  if (input.stock.availableQuantity <= 0) {
    return "out_of_stock";
  }

  if (input.stock.reservedQuantity > 0 && input.stock.availableQuantity <= input.stock.safetyStock) {
    return "reserved";
  }

  if (
    input.stock.availableQuantity <= input.stock.reorderPoint ||
    input.stock.availableQuantity <= input.stock.safetyStock
  ) {
    return "low_stock";
  }

  return "in_stock";
}

export function evaluateReorder(stock: InventoryStockRecord, product: ProductConfiguration): InventoryReorderEvaluation {
  const locationIsActionable =
    product.lifecycleState !== "archived" && product.lifecycleState !== "suspended";
  const available = stock.availableQuantity;

  if (!locationIsActionable) {
    return {
      productId: stock.productId,
      locationId: stock.locationId,
      reorderRecommended: false,
      suggestedReorderQuantity: 0,
      reason: "Product lifecycle does not permit reorder operations.",
      warningLevel: "none",
      evaluationTimestamp: nowIso(),
    };
  }

  const shortfall = Math.max(0, stock.safetyStock + stock.reorderPoint - available);
  const suggested = shortfall > 0 ? Math.max(stock.reorderQuantity, shortfall) : 0;
  const reorderRecommended = available <= stock.reorderPoint;

  let warningLevel: "none" | "low" | "medium" | "high" = "none";
  if (available <= 0) {
    warningLevel = "high";
  } else if (reorderRecommended) {
    warningLevel = available <= stock.safetyStock ? "medium" : "low";
  }

  return {
    productId: stock.productId,
    locationId: stock.locationId,
    reorderRecommended,
    suggestedReorderQuantity: suggested,
    reason: reorderRecommended
      ? "Available quantity is at or below reorder policy threshold."
      : "Available quantity is above reorder threshold.",
    warningLevel,
    evaluationTimestamp: nowIso(),
  };
}
