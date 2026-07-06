export interface ObjectPermission {
  permissionId: string;
  subject: string;
  action: string;
  scope?: string;
  conditions?: Record<string, unknown>;
}
