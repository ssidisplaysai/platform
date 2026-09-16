import type { ProductMediaApprovalState, ProductMediaAuthorityClass } from "./product-media-authority";

export type ProductMediaReviewControlState = {
  label: "PENDING OWNER APPROVAL" | "APPROVED" | "REJECTED";
  approvalActionVisible: boolean;
  rejectionActionVisible: boolean;
  reviewFieldsEditable: boolean;
};

export type ProductMediaReviewDraft = {
  authorityClass: ProductMediaAuthorityClass;
  usageScopes: ProductMediaAuthorityClass[];
  depictsActualProduct: boolean;
  heroEligible: boolean;
  altTextAuthority: string;
  captionAuthority: string;
};

export function createProductMediaReviewDraft(record: ProductMediaReviewDraft & { proposedUsageScopes: readonly ProductMediaAuthorityClass[] }): ProductMediaReviewDraft {
  return {
    authorityClass: record.authorityClass,
    usageScopes: [...record.proposedUsageScopes],
    depictsActualProduct: record.depictsActualProduct,
    heroEligible: record.heroEligible,
    altTextAuthority: record.altTextAuthority,
    captionAuthority: record.captionAuthority,
  };
}

export function projectProductMediaReviewControlState(status: ProductMediaApprovalState): ProductMediaReviewControlState {
  if (status === "APPROVED") {
    return { label: "APPROVED", approvalActionVisible: false, rejectionActionVisible: false, reviewFieldsEditable: false };
  }
  if (status === "REJECTED") {
    return { label: "REJECTED", approvalActionVisible: true, rejectionActionVisible: false, reviewFieldsEditable: true };
  }
  return { label: "PENDING OWNER APPROVAL", approvalActionVisible: true, rejectionActionVisible: true, reviewFieldsEditable: true };
}