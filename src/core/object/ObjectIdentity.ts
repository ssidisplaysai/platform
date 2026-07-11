export interface ObjectIdentity {
  objectId: string;
  objectType: string;
  definitionId: string;
  namespace: string;
  tenantId?: string;
  createdAt: Date;
}
