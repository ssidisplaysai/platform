export class RecoveryManager {
  private readonly steps = new Set<string>();

  registerDefaultSteps(): void {
    this.steps.add("restart");
    this.steps.add("reload");
    this.steps.add("dependency-rebuild");
    this.steps.add("plugin-recovery");
    this.steps.add("service-recovery");
    this.steps.add("module-recovery");
    this.steps.add("runtime-recovery");
  }

  stepsList(): readonly string[] {
    return Object.freeze([...this.steps].sort((a, b) => a.localeCompare(b)));
  }
}
