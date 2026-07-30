import type {
  SalesOrderListFilters,
  SalesOrderRecord,
  SalesOrderSearchFilters,
  SalesOrderSearchResult,
} from "./sales-order-types";

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

export function filterSalesOrders(
  orders: readonly SalesOrderRecord[],
  filters: SalesOrderListFilters = {},
): readonly SalesOrderRecord[] {
  return orders.filter((order) => {
    if (filters.organizationId && order.organizationId !== filters.organizationId) {
      return false;
    }

    if (filters.siteReference && order.siteReference !== filters.siteReference) {
      return false;
    }

    if (filters.customerReference && order.customerReference !== filters.customerReference) {
      return false;
    }

    if (filters.status && order.status !== filters.status) {
      return false;
    }

    if (filters.salespersonReference && order.salesRepresentativeReference !== filters.salespersonReference) {
      return false;
    }

    if (filters.referenceNumber && order.referenceNumber !== filters.referenceNumber) {
      return false;
    }

    if (filters.query) {
      const q = normalized(filters.query);
      const lineText = order.lines
        .map((line) => `${line.sku} ${line.productId} ${line.displayName}`)
        .join(" ")
        .toLowerCase();
      const candidate = `${order.orderNumber} ${order.customerReference} ${order.quoteLineage.quoteId} ${order.status} ${order.referenceNumber ?? ""} ${order.salesRepresentativeReference ?? ""} ${lineText}`.toLowerCase();
      if (!candidate.includes(q)) {
        return false;
      }
    }

    return true;
  });
}

export function searchSalesOrders(
  orders: readonly SalesOrderRecord[],
  filters: SalesOrderSearchFilters,
): readonly SalesOrderSearchResult[] {
  const q = normalized(filters.query);

  return orders
    .filter((order) => {
      if (filters.organizationId && order.organizationId !== filters.organizationId) {
        return false;
      }
      if (filters.siteReference && order.siteReference !== filters.siteReference) {
        return false;
      }
      return true;
    })
    .map((order) => {
      const matchedFields: string[] = [];

      if (normalized(order.orderNumber).includes(q)) {
        matchedFields.push("orderNumber");
      }
      if (normalized(order.customerReference).includes(q)) {
        matchedFields.push("customer");
      }
      if (normalized(order.quoteLineage.quoteId).includes(q)) {
        matchedFields.push("quote");
      }
      if (normalized(order.status).includes(q)) {
        matchedFields.push("status");
      }
      if (order.referenceNumber && normalized(order.referenceNumber).includes(q)) {
        matchedFields.push("reference");
      }
      if (order.salesRepresentativeReference && normalized(order.salesRepresentativeReference).includes(q)) {
        matchedFields.push("salesperson");
      }
      if (normalized(order.createdAt).includes(q) || normalized(order.updatedAt).includes(q) || normalized(order.orderDate).includes(q)) {
        matchedFields.push("date");
      }

      order.lines.forEach((line) => {
        if (normalized(line.sku).includes(q)) {
          matchedFields.push("sku");
        }
        if (normalized(line.productId).includes(q) || normalized(line.displayName).includes(q)) {
          matchedFields.push("product");
        }
      });

      return {
        orderId: order.documentId,
        orderNumber: order.orderNumber,
        customerReference: order.customerReference,
        quoteId: order.quoteLineage.quoteId,
        status: order.status,
        salespersonReference: order.salesRepresentativeReference,
        referenceNumber: order.referenceNumber,
        matchedFields: Array.from(new Set(matchedFields)),
      };
    })
    .filter((result) => result.matchedFields.length > 0);
}
