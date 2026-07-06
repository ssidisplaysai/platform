export interface GenesisDefinition {
  definitionId: string;
  objectType: string;
  namespace: string;
  version: string;
  displayName: string;
  description?: string;
  fields: GenesisDefinitionField[];
  relationships?: GenesisDefinitionRelationship[];
  lifecycle?: string[];
  capabilities?: string[];
}

export interface GenesisDefinitionField {
  name: string;
  type: string;
  required: boolean;
  label?: string;
  description?: string;
}

export interface GenesisDefinitionRelationship {
  name: string;
  targetObjectType: string;
  relationshipType: string;
}
