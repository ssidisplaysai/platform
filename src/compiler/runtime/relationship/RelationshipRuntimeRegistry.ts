import { deepFreeze } from "../foundation/immutability";
import { RelationshipRuntimeFactory } from "./RelationshipRuntimeFactory";
import type {
  RegisteredRelationshipRuntime,
  RelationshipRuntimeObject,
  RelationshipRuntimeRegistryOptions,
  RelationshipValidationResult,
  RelationshipValidator,
} from "./contracts";

export class RelationshipRuntimeRegistry {
  private readonly factory: RelationshipRuntimeFactory;

  private readonly validators: readonly RelationshipValidator[];

  private readonly clock: () => string;

  private readonly records = new Map<string, RegisteredRelationshipRuntime>();

  public constructor(options: RelationshipRuntimeRegistryOptions) {
    this.factory = options.factory as RelationshipRuntimeFactory;
    this.validators = deepFreeze([...(options.validators ?? [])]);
    this.clock = options.clock ?? (() => new Date().toISOString());
  }

  public register(relationship: RelationshipRuntimeObject): RegisteredRelationshipRuntime {
    const validation = this.factory.validateRelationship(relationship, this.validators);
    this.assertNoValidationFailures(validation);

    const record: RegisteredRelationshipRuntime = deepFreeze({
      relationship,
      validation,
      registeredAt: this.clock(),
    });

    // Duplicate registration keys intentionally overwrite prior immutable snapshots.
    this.records.set(relationship.identity.relationshipId, record);
    return record;
  }

  public getByRelationshipId(relationshipId: string): RegisteredRelationshipRuntime | undefined {
    return this.records.get(relationshipId);
  }

  public listAll(): readonly RegisteredRelationshipRuntime[] {
    return deepFreeze(
      [...this.records.values()].sort((left, right) =>
        left.relationship.identity.relationshipId.localeCompare(right.relationship.identity.relationshipId),
      ),
    );
  }

  public deleteByRelationshipId(relationshipId: string): boolean {
    return this.records.delete(relationshipId);
  }

  public count(): number {
    return this.records.size;
  }

  private assertNoValidationFailures(validation: readonly RelationshipValidationResult[]): void {
    const failed = validation.find((result) => result.status === "fail");
    if (failed) {
      throw new Error(`Relationship validation failed: ${failed.code} ${failed.message}`.trim());
    }
  }
}
