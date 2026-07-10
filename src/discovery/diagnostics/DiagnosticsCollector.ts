/**
 * Genesis Discovery Engine — Diagnostics Collector
 *
 * Accumulates structured diagnostics throughout the import pipeline.
 * Never discards content. Every warning and error is preserved in the output.
 */

import {
  DiagnosticCode,
  DiagnosticSeverity,
  DiscoveryDiagnostic,
} from '../models';

export class DiagnosticsCollector {
  private readonly diagnostics: DiscoveryDiagnostic[] = [];

  // ---------------------------------------------------------------------------
  // Fluent emit methods
  // ---------------------------------------------------------------------------

  info(
    code: DiagnosticCode,
    message: string,
    context?: Partial<Omit<DiscoveryDiagnostic, 'code' | 'severity' | 'message' | 'timestamp'>>,
  ): this {
    return this.emit('info', code, message, context);
  }

  warn(
    code: DiagnosticCode,
    message: string,
    context?: Partial<Omit<DiscoveryDiagnostic, 'code' | 'severity' | 'message' | 'timestamp'>>,
  ): this {
    return this.emit('warning', code, message, context);
  }

  error(
    code: DiagnosticCode,
    message: string,
    context?: Partial<Omit<DiscoveryDiagnostic, 'code' | 'severity' | 'message' | 'timestamp'>>,
  ): this {
    return this.emit('error', code, message, context);
  }

  // ---------------------------------------------------------------------------
  // Inspection
  // ---------------------------------------------------------------------------

  hasErrors(): boolean {
    return this.diagnostics.some((d) => d.severity === 'error');
  }

  hasWarnings(): boolean {
    return this.diagnostics.some((d) => d.severity === 'warning');
  }

  getAll(): DiscoveryDiagnostic[] {
    return [...this.diagnostics];
  }

  getErrors(): DiscoveryDiagnostic[] {
    return this.diagnostics.filter((d) => d.severity === 'error');
  }

  getWarnings(): DiscoveryDiagnostic[] {
    return this.diagnostics.filter((d) => d.severity === 'warning');
  }

  getInfos(): DiscoveryDiagnostic[] {
    return this.diagnostics.filter((d) => d.severity === 'info');
  }

  count(): number {
    return this.diagnostics.length;
  }

  /**
   * Absorb diagnostics from another collector or a raw array.
   * Used to merge diagnostics from sub-stages into a parent result.
   */
  absorb(source: DiagnosticsCollector | DiscoveryDiagnostic[]): this {
    const list = Array.isArray(source) ? source : source.getAll();
    for (const d of list) {
      this.diagnostics.push(d);
    }
    return this;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private emit(
    severity: DiagnosticSeverity,
    code: DiagnosticCode,
    message: string,
    extra?: Partial<Omit<DiscoveryDiagnostic, 'code' | 'severity' | 'message' | 'timestamp'>>,
  ): this {
    this.diagnostics.push({
      code,
      severity,
      message,
      timestamp: new Date().toISOString(),
      ...extra,
    });
    return this;
  }
}
