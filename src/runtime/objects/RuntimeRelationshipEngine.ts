import { createHash } from "node:crypto";

import type { RuntimeRelationshipEdge } from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

function canonicalAttributes(attributes: Readonly<Record<string, string | number | boolean>>): Readonly<Record<string, string | number | boolean>> {
  return deepFreeze(Object.fromEntries(Object.entries(attributes).sort((a, b) => a[0].localeCompare(b[0]))));
}

export class RuntimeRelationshipEngine {
  private readonly edges = new Map<string, RuntimeRelationshipEdge>();

  addRelationship(
    sourceObjectId: string,
    relationshipType: string,
    targetObjectId: string,
    attributes: Readonly<Record<string, string | number | boolean>> = {},
    validate?: (objectId: string) => boolean,
  ): RuntimeRelationshipEdge {
    if (validate && (!validate(sourceObjectId) || !validate(targetObjectId))) {
      throw new Error("GRT-OBJ-REL-001: Relationship references unknown objects");
    }

    const canonical = canonicalAttributes(attributes);
    const relationshipId = this.relationshipId(sourceObjectId, relationshipType, targetObjectId, canonical);
    if (this.edges.has(relationshipId)) {
      throw new Error(`GRT-OBJ-REL-002: Duplicate relationship: ${relationshipId}`);
    }

    const edge = deepFreeze({
      relationshipId,
      sourceObjectId,
      relationshipType,
      targetObjectId,
      attributes: canonical,
    });

    this.edges.set(relationshipId, edge);
    return edge;
  }

  list(): readonly RuntimeRelationshipEdge[] {
    return Object.freeze([...this.edges.values()].sort((a, b) => {
      const left = `${a.sourceObjectId}|${a.relationshipType}|${a.targetObjectId}|${a.relationshipId}`;
      const right = `${b.sourceObjectId}|${b.relationshipType}|${b.targetObjectId}|${b.relationshipId}`;
      return left.localeCompare(right);
    }));
  }

  private relationshipId(
    sourceObjectId: string,
    relationshipType: string,
    targetObjectId: string,
    attributes: Readonly<Record<string, string | number | boolean>>,
  ): string {
    const hash = createHash("sha256")
      .update(JSON.stringify({ sourceObjectId, relationshipType, targetObjectId, attributes }))
      .digest("hex");
    return `relationship-${hash.slice(0, 16)}`;
  }
}
