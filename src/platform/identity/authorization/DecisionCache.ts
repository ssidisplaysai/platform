import type { AuthorizationContext } from "./AuthorizationContext";
import type { AuthorizationDecision } from "./AuthorizationDecision";

type CacheEntry = {
  decision: AuthorizationDecision;
  expiresAtMs: number;
};

export type DecisionCacheStats = {
  size: number;
  hitCount: number;
  missCount: number;
  invalidationCount: number;
};

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const objectRecord = value as Record<string, unknown>;
    const keys = Object.keys(objectRecord).sort();
    const pairs = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(objectRecord[key])}`);
    return `{${pairs.join(",")}}`;
  }

  return JSON.stringify(value);
}

export class DecisionCache {
  private readonly entries = new Map<string, CacheEntry>();
  private hitCount = 0;
  private missCount = 0;
  private invalidationCount = 0;

  constructor(private readonly ttlMs: number) {}

  keyFor(context: AuthorizationContext): string {
    return stableStringify({
      principalId: context.principalId,
      actionId: context.actionId,
      actionType: context.actionType,
      workspaceId: context.workspaceId,
      moduleId: context.moduleId,
      roles: [...context.roles].sort(),
      permissions: [...context.permissionSet.directPermissions].sort(),
      memberships: context.memberships
        .map((membership) => ({
          workspaceId: membership.workspaceId,
          role: membership.role,
          active: membership.active,
          permissions: [...membership.permissions].sort(),
        }))
        .sort((left, right) => left.workspaceId.localeCompare(right.workspaceId)),
      resource: context.resource,
    });
  }

  get(key: string): AuthorizationDecision | null {
    const entry = this.entries.get(key);
    if (!entry) {
      this.missCount += 1;
      return null;
    }

    if (entry.expiresAtMs <= Date.now()) {
      this.entries.delete(key);
      this.missCount += 1;
      return null;
    }

    this.hitCount += 1;
    return entry.decision;
  }

  set(key: string, decision: AuthorizationDecision): void {
    this.entries.set(key, {
      decision,
      expiresAtMs: Date.now() + this.ttlMs,
    });
  }

  invalidate(key?: string): void {
    if (key) {
      this.entries.delete(key);
    } else {
      this.entries.clear();
    }

    this.invalidationCount += 1;
  }

  stats(): DecisionCacheStats {
    return {
      size: this.entries.size,
      hitCount: this.hitCount,
      missCount: this.missCount,
      invalidationCount: this.invalidationCount,
    };
  }
}
