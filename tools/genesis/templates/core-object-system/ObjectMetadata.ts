export interface ObjectMetadata {
  displayName: string;
  description?: string;
  tags?: string[];
  labels?: string[];
  categories?: string[];
  custom?: Record<string, unknown>;
}
