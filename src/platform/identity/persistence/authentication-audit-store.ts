import type { IdentityAuditRecord } from "../contracts";
import type { IdentityAuditSink } from "../ports";
import { getPrismaClient } from "@/lib/glw/prisma";

export type IdentityAuditStore = IdentityAuditSink & {
  listRecent(limit: number): Promise<IdentityAuditRecord[]>;
};

function toRecord(record: {
  auditId: string;
  eventType: string;
  principalId: string | null;
  workspaceId: string | null;
  occurredAt: Date;
  actorPrincipalId: string | null;
  correlationId: string | null;
  causationId: string | null;
  outcome: string;
  details: unknown;
}): IdentityAuditRecord {
  return {
    auditId: record.auditId,
    eventType: record.eventType as IdentityAuditRecord["eventType"],
    principalId: record.principalId ?? undefined,
    workspaceId: record.workspaceId ?? undefined,
    occurredAt: record.occurredAt.toISOString(),
    actorPrincipalId: record.actorPrincipalId ?? undefined,
    correlationId: record.correlationId ?? undefined,
    causationId: record.causationId ?? undefined,
    outcome: record.outcome as IdentityAuditRecord["outcome"],
    details: (record.details ?? {}) as IdentityAuditRecord["details"],
  };
}

export class PrismaAuthenticationAuditStore implements IdentityAuditStore {
  async publish(record: IdentityAuditRecord): Promise<void> {
    await getPrismaClient().identityAuthenticationAudit.create({
      data: {
        auditId: record.auditId,
        eventType: record.eventType,
        principalId: record.principalId ?? null,
        workspaceId: record.workspaceId ?? null,
        occurredAt: new Date(record.occurredAt),
        actorPrincipalId: record.actorPrincipalId ?? null,
        correlationId: record.correlationId ?? null,
        causationId: record.causationId ?? null,
        outcome: record.outcome,
        details: record.details,
      },
    });
  }

  async listRecent(limit: number): Promise<IdentityAuditRecord[]> {
    const rows = await getPrismaClient().identityAuthenticationAudit.findMany({
      orderBy: {
        occurredAt: "desc",
      },
      take: Math.max(1, Math.min(1000, limit)),
    });

    return rows.map(toRecord);
  }
}

export class InMemoryAuthenticationAuditStore implements IdentityAuditStore {
  private readonly records: IdentityAuditRecord[] = [];

  async publish(record: IdentityAuditRecord): Promise<void> {
    this.records.push(record);
  }

  async listRecent(limit: number): Promise<IdentityAuditRecord[]> {
    const bounded = Math.max(1, Math.min(1000, limit));
    return this.records.slice(-bounded).reverse();
  }
}

class CompositeAuthenticationAuditStore implements IdentityAuditStore {
  constructor(
    private readonly primary: IdentityAuditStore,
    private readonly secondary: IdentityAuditStore,
  ) {}

  async publish(record: IdentityAuditRecord): Promise<void> {
    await this.primary.publish(record);
    await this.secondary.publish(record);
  }

  async listRecent(limit: number): Promise<IdentityAuditRecord[]> {
    return this.secondary.listRecent(limit);
  }
}

class ResilientAuthenticationAuditStore implements IdentityAuditStore {
  constructor(
    private readonly primary: IdentityAuditStore,
    private readonly fallback: IdentityAuditStore,
  ) {}

  async publish(record: IdentityAuditRecord): Promise<void> {
    try {
      await this.primary.publish(record);
    } catch {
      await this.fallback.publish(record);
    }
  }

  async listRecent(limit: number): Promise<IdentityAuditRecord[]> {
    try {
      const records = await this.primary.listRecent(limit);
      if (records.length > 0) {
        return records;
      }
    } catch {
      // fall back
    }

    return this.fallback.listRecent(limit);
  }
}

let defaultAuditStore: IdentityAuditStore | null = null;

export function getDefaultAuthenticationAuditStore(): IdentityAuditStore {
  if (defaultAuditStore) {
    return defaultAuditStore;
  }

  const inMemoryMirror = new InMemoryAuthenticationAuditStore();

  if (process.env.DATABASE_URL) {
    const composite = new CompositeAuthenticationAuditStore(
      new PrismaAuthenticationAuditStore(),
      inMemoryMirror,
    );
    defaultAuditStore = new ResilientAuthenticationAuditStore(composite, inMemoryMirror);
    return defaultAuditStore;
  }

  defaultAuditStore = inMemoryMirror;
  return defaultAuditStore;
}
