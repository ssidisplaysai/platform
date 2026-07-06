export interface ObjectAudit {
  createdBy?: string;
  createdAt: Date;
  updatedBy?: string;
  updatedAt?: Date;
  changes?: ObjectAuditChange[];
}

export interface ObjectAuditChange {
  changeId: string;
  changedBy?: string;
  changedAt: Date;
  field: string;
  previousValue?: unknown;
  nextValue?: unknown;
  reason?: string;
}
