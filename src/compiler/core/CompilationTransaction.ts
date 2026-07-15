export class CompilationTransaction {
  private readonly rollbackHooks: Array<{ readonly passId: string; readonly rollback: () => Promise<void> | void }> = [];

  register(passId: string, rollback: (() => Promise<void> | void) | undefined): void {
    if (!rollback) {
      return;
    }

    this.rollbackHooks.push({ passId, rollback });
  }

  async rollback(): Promise<readonly string[]> {
    const rolledBack: string[] = [];

    for (const entry of [...this.rollbackHooks].reverse()) {
      await entry.rollback();
      rolledBack.push(entry.passId);
    }

    return rolledBack;
  }
}