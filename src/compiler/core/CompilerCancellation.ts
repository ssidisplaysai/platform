import { CompilerException } from "./CompilerException";

export class CompilerCancellation {
  private cancelled = false;
  private cancellationReason?: string;

  cancel(reason = "Compilation cancelled"): void {
    this.cancelled = true;
    this.cancellationReason = reason;
  }

  get snapshot(): { readonly cancelled: boolean; readonly reason?: string } {
    return {
      cancelled: this.cancelled,
      reason: this.cancellationReason,
    };
  }

  throwIfCancelled(): void {
    if (this.cancelled) {
      throw new CompilerException("COMPILATION_CANCELLED", this.cancellationReason ?? "Compilation cancelled", "cancellation");
    }
  }
}