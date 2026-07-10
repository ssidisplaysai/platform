/**
 * Genesis Discovery Engine — Discovery Validator
 *
 * Runs all validation rules against a DiscoveryDocument and DiscoveryInterview.
 * Returns a DiscoveryValidationResult without modifying either artifact.
 *
 * Validation is read-only. It observes, classifies, and reports.
 * It never rewrites, repairs, or infers.
 */

import {
  DiscoveryDiagnostic,
  DiscoveryDocument,
  DiscoveryInterview,
  DiscoveryValidationResult,
} from '../models';
import { documentRules, interviewRules } from './ValidationRules';

export class DiscoveryValidator {
  validate(
    document: DiscoveryDocument,
    interview: DiscoveryInterview,
  ): DiscoveryValidationResult {
    const all: DiscoveryDiagnostic[] = [];

    // Run document rules.
    for (const rule of documentRules) {
      const result = rule(document);
      if (result) all.push(result);
    }

    // Run interview rules.
    for (const rule of interviewRules) {
      const result = rule(interview);
      if (result) all.push(result);
    }

    const errors = all.filter((d) => d.severity === 'error');
    const warnings = all.filter((d) => d.severity === 'warning');
    const infos = all.filter((d) => d.severity === 'info');

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      infos,
    };
  }

  /**
   * Validate a document only (when no interview is available).
   */
  validateDocument(document: DiscoveryDocument): DiscoveryValidationResult {
    const all: DiscoveryDiagnostic[] = [];

    for (const rule of documentRules) {
      const result = rule(document);
      if (result) all.push(result);
    }

    const errors = all.filter((d) => d.severity === 'error');
    const warnings = all.filter((d) => d.severity === 'warning');
    const infos = all.filter((d) => d.severity === 'info');

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      infos,
    };
  }

  /**
   * Validate an interview only (when no document is available).
   */
  validateInterview(interview: DiscoveryInterview): DiscoveryValidationResult {
    const all: DiscoveryDiagnostic[] = [];

    for (const rule of interviewRules) {
      const result = rule(interview);
      if (result) all.push(result);
    }

    const errors = all.filter((d) => d.severity === 'error');
    const warnings = all.filter((d) => d.severity === 'warning');
    const infos = all.filter((d) => d.severity === 'info');

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      infos,
    };
  }
}
