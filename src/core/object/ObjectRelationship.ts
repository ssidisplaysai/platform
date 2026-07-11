export interface ObjectRelationship {
  relationshipId: string;
  name: string;
  sourceObjectId: string;
  targetObjectId: string;
  relationshipType: string;
  metadata?: Record<string, unknown>;
}
