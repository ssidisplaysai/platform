import { getPrismaClient } from "@/lib/glw/prisma";

export type DurableSessionRecord = {
  sessionId: string;
  tokenHash: string;
  principalId: string;
  identityId: string;
  authenticationContextId: string;
  issuedAt: string;
  expiresAt: string;
  revokedAt?: string;
  revocationReasonCode?: string;
  revokedByPrincipalId?: string;
  active: boolean;
};

export type CreateDurableSessionRecordInput = {
  sessionId: string;
  tokenHash: string;
  principalId: string;
  identityId: string;
  authenticationContextId: string;
  issuedAt: string;
  expiresAt: string;
};

export type SessionRecordStore = {
  saveIssuedSession(input: CreateDurableSessionRecordInput): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<DurableSessionRecord | null>;
  findBySessionId(sessionId: string): Promise<DurableSessionRecord | null>;
  revokeByTokenHash(input: { tokenHash: string; reasonCode: string; actorPrincipalId?: string }): Promise<boolean>;
  revokeBySessionId(input: { sessionId: string; reasonCode: string; actorPrincipalId?: string }): Promise<boolean>;
  rotateSession(input: {
    oldTokenHash: string;
    replacement: CreateDurableSessionRecordInput;
    reasonCode: string;
    actorPrincipalId?: string;
  }): Promise<boolean>;
  countActiveSessions(referenceTime: string): Promise<number>;
};

function toRecord(record: {
  sessionId: string;
  tokenHash: string;
  principalId: string;
  identityId: string;
  authenticationContextId: string;
  issuedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revocationReasonCode: string | null;
  revokedByPrincipalId: string | null;
  active: boolean;
}): DurableSessionRecord {
  return {
    sessionId: record.sessionId,
    tokenHash: record.tokenHash,
    principalId: record.principalId,
    identityId: record.identityId,
    authenticationContextId: record.authenticationContextId,
    issuedAt: record.issuedAt.toISOString(),
    expiresAt: record.expiresAt.toISOString(),
    revokedAt: record.revokedAt?.toISOString(),
    revocationReasonCode: record.revocationReasonCode ?? undefined,
    revokedByPrincipalId: record.revokedByPrincipalId ?? undefined,
    active: record.active,
  };
}

export class PrismaSessionRecordStore implements SessionRecordStore {
  async saveIssuedSession(input: CreateDurableSessionRecordInput): Promise<void> {
    await getPrismaClient().identitySessionRecord.upsert({
      where: { sessionId: input.sessionId },
      create: {
        sessionId: input.sessionId,
        tokenHash: input.tokenHash,
        principalId: input.principalId,
        identityId: input.identityId,
        authenticationContextId: input.authenticationContextId,
        issuedAt: new Date(input.issuedAt),
        expiresAt: new Date(input.expiresAt),
        active: true,
      },
      update: {
        tokenHash: input.tokenHash,
        principalId: input.principalId,
        identityId: input.identityId,
        authenticationContextId: input.authenticationContextId,
        issuedAt: new Date(input.issuedAt),
        expiresAt: new Date(input.expiresAt),
        revokedAt: null,
        revocationReasonCode: null,
        revokedByPrincipalId: null,
        active: true,
      },
    });
  }

  async findByTokenHash(tokenHash: string): Promise<DurableSessionRecord | null> {
    const record = await getPrismaClient().identitySessionRecord.findUnique({
      where: { tokenHash },
    });

    return record ? toRecord(record) : null;
  }

  async findBySessionId(sessionId: string): Promise<DurableSessionRecord | null> {
    const record = await getPrismaClient().identitySessionRecord.findUnique({
      where: { sessionId },
    });

    return record ? toRecord(record) : null;
  }

  async revokeByTokenHash(input: { tokenHash: string; reasonCode: string; actorPrincipalId?: string }): Promise<boolean> {
    const result = await getPrismaClient().identitySessionRecord.updateMany({
      where: {
        tokenHash: input.tokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revocationReasonCode: input.reasonCode,
        revokedByPrincipalId: input.actorPrincipalId ?? null,
        active: false,
      },
    });

    return result.count > 0;
  }

  async revokeBySessionId(input: { sessionId: string; reasonCode: string; actorPrincipalId?: string }): Promise<boolean> {
    const result = await getPrismaClient().identitySessionRecord.updateMany({
      where: {
        sessionId: input.sessionId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revocationReasonCode: input.reasonCode,
        revokedByPrincipalId: input.actorPrincipalId ?? null,
        active: false,
      },
    });

    return result.count > 0;
  }

  async rotateSession(input: {
    oldTokenHash: string;
    replacement: CreateDurableSessionRecordInput;
    reasonCode: string;
    actorPrincipalId?: string;
  }): Promise<boolean> {
    const prisma = getPrismaClient();

    const [revokeResult] = await prisma.$transaction([
      prisma.identitySessionRecord.updateMany({
        where: {
          tokenHash: input.oldTokenHash,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          revocationReasonCode: input.reasonCode,
          revokedByPrincipalId: input.actorPrincipalId ?? null,
          active: false,
        },
      }),
      prisma.identitySessionRecord.upsert({
        where: { sessionId: input.replacement.sessionId },
        create: {
          sessionId: input.replacement.sessionId,
          tokenHash: input.replacement.tokenHash,
          principalId: input.replacement.principalId,
          identityId: input.replacement.identityId,
          authenticationContextId: input.replacement.authenticationContextId,
          issuedAt: new Date(input.replacement.issuedAt),
          expiresAt: new Date(input.replacement.expiresAt),
          active: true,
        },
        update: {
          tokenHash: input.replacement.tokenHash,
          principalId: input.replacement.principalId,
          identityId: input.replacement.identityId,
          authenticationContextId: input.replacement.authenticationContextId,
          issuedAt: new Date(input.replacement.issuedAt),
          expiresAt: new Date(input.replacement.expiresAt),
          revokedAt: null,
          revocationReasonCode: null,
          revokedByPrincipalId: null,
          active: true,
        },
      }),
    ]);

    return revokeResult.count > 0;
  }

  async countActiveSessions(referenceTime: string): Promise<number> {
    return getPrismaClient().identitySessionRecord.count({
      where: {
        active: true,
        revokedAt: null,
        expiresAt: {
          gt: new Date(referenceTime),
        },
      },
    });
  }
}

export class InMemorySessionRecordStore implements SessionRecordStore {
  private readonly recordsBySessionId = new Map<string, DurableSessionRecord>();
  private readonly sessionIdByTokenHash = new Map<string, string>();

  async saveIssuedSession(input: CreateDurableSessionRecordInput): Promise<void> {
    const record: DurableSessionRecord = {
      sessionId: input.sessionId,
      tokenHash: input.tokenHash,
      principalId: input.principalId,
      identityId: input.identityId,
      authenticationContextId: input.authenticationContextId,
      issuedAt: input.issuedAt,
      expiresAt: input.expiresAt,
      active: true,
    };

    this.recordsBySessionId.set(input.sessionId, record);
    this.sessionIdByTokenHash.set(input.tokenHash, input.sessionId);
  }

  async findByTokenHash(tokenHash: string): Promise<DurableSessionRecord | null> {
    const sessionId = this.sessionIdByTokenHash.get(tokenHash);
    if (!sessionId) {
      return null;
    }

    return this.recordsBySessionId.get(sessionId) ?? null;
  }

  async findBySessionId(sessionId: string): Promise<DurableSessionRecord | null> {
    return this.recordsBySessionId.get(sessionId) ?? null;
  }

  async revokeByTokenHash(input: { tokenHash: string; reasonCode: string; actorPrincipalId?: string }): Promise<boolean> {
    const sessionId = this.sessionIdByTokenHash.get(input.tokenHash);
    if (!sessionId) {
      return false;
    }

    return this.revokeBySessionId({
      sessionId,
      reasonCode: input.reasonCode,
      actorPrincipalId: input.actorPrincipalId,
    });
  }

  async revokeBySessionId(input: { sessionId: string; reasonCode: string; actorPrincipalId?: string }): Promise<boolean> {
    const record = this.recordsBySessionId.get(input.sessionId);
    if (!record || record.revokedAt) {
      return false;
    }

    this.recordsBySessionId.set(input.sessionId, {
      ...record,
      revokedAt: new Date().toISOString(),
      revocationReasonCode: input.reasonCode,
      revokedByPrincipalId: input.actorPrincipalId,
      active: false,
    });

    return true;
  }

  async rotateSession(input: {
    oldTokenHash: string;
    replacement: CreateDurableSessionRecordInput;
    reasonCode: string;
    actorPrincipalId?: string;
  }): Promise<boolean> {
    const revoked = await this.revokeByTokenHash({
      tokenHash: input.oldTokenHash,
      reasonCode: input.reasonCode,
      actorPrincipalId: input.actorPrincipalId,
    });

    await this.saveIssuedSession(input.replacement);
    return revoked;
  }

  async countActiveSessions(referenceTime: string): Promise<number> {
    const now = new Date(referenceTime).getTime();
    let count = 0;

    for (const record of this.recordsBySessionId.values()) {
      if (record.active && !record.revokedAt && new Date(record.expiresAt).getTime() > now) {
        count += 1;
      }
    }

    return count;
  }
}

class ResilientSessionRecordStore implements SessionRecordStore {
  constructor(
    private readonly primary: SessionRecordStore,
    private readonly fallback: SessionRecordStore,
  ) {}

  async saveIssuedSession(input: CreateDurableSessionRecordInput): Promise<void> {
    try {
      await this.primary.saveIssuedSession(input);
    } catch {
      await this.fallback.saveIssuedSession(input);
    }
  }

  async findByTokenHash(tokenHash: string): Promise<DurableSessionRecord | null> {
    try {
      return await this.primary.findByTokenHash(tokenHash);
    } catch {
      return this.fallback.findByTokenHash(tokenHash);
    }
  }

  async findBySessionId(sessionId: string): Promise<DurableSessionRecord | null> {
    try {
      return await this.primary.findBySessionId(sessionId);
    } catch {
      return this.fallback.findBySessionId(sessionId);
    }
  }

  async revokeByTokenHash(input: { tokenHash: string; reasonCode: string; actorPrincipalId?: string }): Promise<boolean> {
    try {
      return await this.primary.revokeByTokenHash(input);
    } catch {
      return this.fallback.revokeByTokenHash(input);
    }
  }

  async revokeBySessionId(input: { sessionId: string; reasonCode: string; actorPrincipalId?: string }): Promise<boolean> {
    try {
      return await this.primary.revokeBySessionId(input);
    } catch {
      return this.fallback.revokeBySessionId(input);
    }
  }

  async rotateSession(input: {
    oldTokenHash: string;
    replacement: CreateDurableSessionRecordInput;
    reasonCode: string;
    actorPrincipalId?: string;
  }): Promise<boolean> {
    try {
      return await this.primary.rotateSession(input);
    } catch {
      return this.fallback.rotateSession(input);
    }
  }

  async countActiveSessions(referenceTime: string): Promise<number> {
    try {
      return await this.primary.countActiveSessions(referenceTime);
    } catch {
      return this.fallback.countActiveSessions(referenceTime);
    }
  }
}

let defaultStore: SessionRecordStore | null = null;

export function getDefaultSessionRecordStore(): SessionRecordStore {
  if (defaultStore) {
    return defaultStore;
  }

  const fallback = new InMemorySessionRecordStore();

  if (process.env.DATABASE_URL) {
    defaultStore = new ResilientSessionRecordStore(new PrismaSessionRecordStore(), fallback);
    return defaultStore;
  }

  defaultStore = fallback;
  return defaultStore;
}
