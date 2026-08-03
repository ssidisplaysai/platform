import type { AIMemoryRecord, AIMemoryScope } from "../contracts";

export type MemoryWriteInput = {
  scope: AIMemoryScope;
  tenant: string;
  workspace: string;
  conversationId?: string;
  sessionId?: string;
  key: string;
  value: string;
  metadata?: Record<string, string>;
};

export class AIContextMemoryStore {
  private readonly records: AIMemoryRecord[] = [];

  write(input: MemoryWriteInput): AIMemoryRecord {
    const record: AIMemoryRecord = {
      recordId: `amemory_${this.records.length + 1}`,
      scope: input.scope,
      tenant: input.tenant,
      workspace: input.workspace,
      conversationId: input.conversationId,
      sessionId: input.sessionId,
      key: input.key,
      value: input.value,
      metadata: input.metadata,
      recordedAt: new Date().toISOString(),
    };

    this.records.push(record);
    return structuredClone(record);
  }

  read(scope: AIMemoryScope, tenant: string, workspace: string, key: string): AIMemoryRecord | undefined {
    const found = this.records.find((record) => record.scope === scope && record.tenant === tenant && record.workspace === workspace && record.key === key);
    return found ? structuredClone(found) : undefined;
  }

  list(scope?: AIMemoryScope, tenant?: string, workspace?: string): AIMemoryRecord[] {
    return this.records
      .filter((record) => (scope ? record.scope === scope : true))
      .filter((record) => (tenant ? record.tenant === tenant : true))
      .filter((record) => (workspace ? record.workspace === workspace : true))
      .map((record) => structuredClone(record));
  }

  clear(): void {
    this.records.length = 0;
  }
}
