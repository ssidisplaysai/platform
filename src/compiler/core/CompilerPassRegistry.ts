import type { CompilerPass, CompilerPassLifecycle, CompilerPassMetadata } from "./types";

export class CompilerPassRegistry {
  private readonly passes = new Map<string, CompilerPass<unknown, unknown>>();

  register(pass: CompilerPass<unknown, unknown>): void {
    if (this.passes.has(pass.metadata.id)) {
      throw new Error(`Pass already registered: ${pass.metadata.id}`);
    }

    this.passes.set(pass.metadata.id, pass);
  }

  list(): CompilerPassMetadata[] {
    return [...this.passes.values()]
      .map((pass) => pass.metadata)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  resolve(passId: string): CompilerPass<unknown, unknown> {
    const pass = this.passes.get(passId);
    if (!pass) {
      throw new Error(`Pass not found: ${passId}`);
    }

    return pass;
  }

  discoverByCapability(capability: string): CompilerPassMetadata[] {
    return this.list().filter((metadata) => metadata.capabilities.includes(capability));
  }

  deprecate(passId: string): void {
    this.setLifecycle(passId, "deprecated");
  }

  replace(passId: string, replacementPassId: string): void {
    this.setLifecycle(passId, "replaced", replacementPassId);
  }

  private setLifecycle(passId: string, lifecycle: CompilerPassLifecycle, replacedBy?: string): void {
    const pass = this.resolve(passId);
    const metadata = pass.metadata;

    (metadata as { lifecycle: CompilerPassLifecycle }).lifecycle = lifecycle;
    if (replacedBy) {
      (metadata as { replacedBy?: string }).replacedBy = replacedBy;
    }
  }
}
