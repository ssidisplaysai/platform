/**
 * GCF-M2 Phase 1: Business Genome Compiler Baseline Capture Script
 * 
 * This script directly instantiates the BusinessGenomeCompiler and records
 * baseline outputs without relying on test framework infrastructure.
 * 
 * Run with: npx ts-node scripts/gcf-m2-capture-bgc-baseline.ts
 */

import { BusinessGenomeCompiler } from '../src/compiler/genome';
import type { BusinessGenomeCompilerInput, BusinessGenomeCompilerOutput } from '../src/compiler/genome/types';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';

interface BaselineFixture {
  name: string;
  description: string;
  input: BusinessGenomeCompilerInput;
  output: {
    status: string;
    success: boolean;
    diagnosticCount: number;
    diagnosticCodes: string[];
    checksumInput: string;
    passOrder?: string[];
    completedPasses?: string[];
    haltedByPassId?: string;
  };
  metadata: {
    capturedAt: string;
    compilerVersion: string;
    iterationCount: number;
  };
}

interface BaselineCollection {
  version: '1.0';
  capturedAt: string;
  totalFixtures: number;
  fixtures: BaselineFixture[];
  determinismVerified: boolean;
  notes: string[];
}

/**
 * Create representative BGC compiler input
 */
function createInput(variant: 'standard' | 'minimal' | 'complex' | 'warning' | 'error'): BusinessGenomeCompilerInput {
  const base: BusinessGenomeCompilerInput = {
    compilerContext: {
      sessionId: 'baseline-session-001',
      config: {},
    } as any,
    evidenceIrIdentity: `evidence-${variant}`,
    canonicalMetadata: {
      version: '1.0',
      sourceType: 'discovery-interview',
    },
    inputValidationRules: [],
    outputValidationRules: [],
    diagnosticConfig: {
      failFast: false,
      maxDiagnostics: 1000,
    },
  };

  switch (variant) {
    case 'minimal':
      // Minimally valid input
      return {
        ...base,
        evidenceIrIdentity: '',
        canonicalMetadata: {},
      };

    case 'complex':
      // Complex multi-source input
      return {
        ...base,
        evidenceIrIdentity: `evidence-complex-${Date.now()}`,
        canonicalMetadata: {
          ...base.canonicalMetadata,
          sources: [
            { id: 'source-1', type: 'interview' },
            { id: 'source-2', type: 'document' },
            { id: 'source-3', type: 'observation' },
          ],
          complexity: 'high',
        },
      };

    case 'warning':
      // Input that should produce warnings
      return {
        ...base,
        diagnosticConfig: {
          failFast: false,
          maxDiagnostics: 100, // Limited diagnostics
        },
      };

    case 'error':
      // Invalid input that should produce errors
      return {
        ...base,
        evidenceIrIdentity: '', // Missing required field
        compilerContext: undefined as any, // Missing context
      };

    default: // 'standard'
      return base;
  }
}

/**
 * Compute SHA256 checksum of input
 */
function computeChecksum(input: any): string {
  const json = JSON.stringify(input, null, 2);
  return crypto.createHash('sha256').update(json).digest('hex');
}

/**
 * Capture single baseline fixture
 */
function captureFixture(
  name: string,
  description: string,
  variant: 'standard' | 'minimal' | 'complex' | 'warning' | 'error'
): BaselineFixture {
  const compiler = new BusinessGenomeCompiler();
  const input = createInput(variant);
  const checksumInput = computeChecksum(input);

  console.log(`\n📋 Capturing: ${name}`);
  console.log(`   Description: ${description}`);
  console.log(`   Input checksum: ${checksumInput.slice(0, 16)}...`);

  const output = compiler.compile(input);

  const diagnosticCodes = output.diagnostics
    .map((d: any) => d.code)
    .filter((code, idx, arr) => arr.indexOf(code) === idx);

  const fixture: BaselineFixture = {
    name,
    description,
    input,
    output: {
      status: output.status,
      success: output.success,
      diagnosticCount: output.diagnostics.length,
      diagnosticCodes,
      checksumInput,
      passOrder: output.execution?.passOrder,
      completedPasses: output.execution?.completedPasses,
      haltedByPassId: output.execution?.haltedByPassId,
    },
    metadata: {
      capturedAt: new Date().toISOString(),
      compilerVersion: '1.0.0',
      iterationCount: 1,
    },
  };

  console.log(`   Status: ${fixture.output.status}`);
  console.log(`   Diagnostics: ${fixture.output.diagnosticCount}`);
  console.log(`   Completed passes: ${fixture.output.completedPasses?.length ?? 0}`);

  return fixture;
}

/**
 * Verify determinism by running same input multiple times
 */
function verifyDeterminism(input: BusinessGenomeCompilerInput, iterations = 3): boolean {
  console.log(`\n🔄 Verifying determinism (${iterations} iterations)...`);

  const compiler = new BusinessGenomeCompiler();
  const results: string[] = [];

  for (let i = 0; i < iterations; i++) {
    const output = compiler.compile(input);
    const checksum = computeChecksum(output);
    results.push(checksum);
    console.log(`   Run ${i + 1}: ${checksum.slice(0, 16)}...`);
  }

  // All checksums should be identical
  const isDeterministic = results.every((checksum) => checksum === results[0]);
  console.log(`   Determinism: ${isDeterministic ? '✅ PASS' : '❌ FAIL'}`);

  return isDeterministic;
}

/**
 * Main baseline capture function
 */
async function captureBaseline() {
  console.log('═'.repeat(80));
  console.log('GCF-M2 PHASE 1: BUSINESS GENOME COMPILER BASELINE CAPTURE');
  console.log('═'.repeat(80));

  const fixtures: BaselineFixture[] = [];

  // Capture standard fixture
  fixtures.push(captureFixture(
    'bgc-baseline-standard',
    'Standard BGC compilation with all required fields',
    'standard'
  ));

  // Capture minimal fixture
  fixtures.push(captureFixture(
    'bgc-baseline-minimal',
    'Minimally valid BGC input',
    'minimal'
  ));

  // Capture complex fixture
  fixtures.push(captureFixture(
    'bgc-baseline-complex',
    'Complex BGC input with multiple sources',
    'complex'
  ));

  // Capture warning fixture
  fixtures.push(captureFixture(
    'bgc-baseline-warning',
    'BGC input that produces warnings',
    'warning'
  ));

  // Capture error fixture
  fixtures.push(captureFixture(
    'bgc-baseline-error',
    'Invalid BGC input that produces errors',
    'error'
  ));

  // Verify determinism on standard fixture
  const standardInput = createInput('standard');
  const determinismOk = verifyDeterminism(standardInput, 3);

  // Create baseline collection
  const baseline: BaselineCollection = {
    version: '1.0',
    capturedAt: new Date().toISOString(),
    totalFixtures: fixtures.length,
    fixtures,
    determinismVerified: determinismOk,
    notes: [
      'Baseline captured on 2026-07-13',
      'GCF-M1 framework approved for adoption',
      'BGC test framework incompatibility noted - Node.js runner vs Jest',
      `${determinismOk ? '✅' : '⚠️'} Determinism verified: ${determinismOk}`,
      'Ready for Phase 2: Baseline fixture comparison during equivalence tests',
    ],
  };

  // Write baseline to file
  const outputDir = path.join(process.cwd(), 'tests', 'fixtures', 'gcf-m2-baselines');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputFile = path.join(outputDir, 'bgc-baseline-v1.0.json');
  fs.writeFileSync(outputFile, JSON.stringify(baseline, null, 2));

  console.log('\n' + '═'.repeat(80));
  console.log('BASELINE CAPTURE COMPLETE');
  console.log('═'.repeat(80));
  console.log(`✅ Baseline saved to: ${outputFile}`);
  console.log(`📊 Fixtures captured: ${baseline.totalFixtures}`);
  console.log(`🔄 Determinism verified: ${determinismOk ? 'YES ✅' : 'NO ❌'}`);
  console.log('═'.repeat(80));

  return baseline;
}

// Run if executed directly
if (require.main === module) {
  captureBaseline().catch((error) => {
    console.error('❌ Error capturing baseline:', error);
    process.exit(1);
  });
}

export { captureBaseline, BaselineFixture, BaselineCollection };
