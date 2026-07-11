/**
 * Process Madison's Discovery Interview through Evidence IR Compiler (Stage 2)
 *
 * This script:
 * 1. Loads Madison's real Discovery Interview (from Stage 1)
 * 2. Passes it through the Evidence IR Compiler
 * 3. Validates all output
 * 4. Exports artifacts as JSON
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { EvidenceIRPipeline } from './pipeline/index';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('='.repeat(70));
  console.log('EVIDENCE IR STAGE 2 - MADISON INTERVIEW PROCESSING');
  console.log('='.repeat(70));
  console.log();

  try {
    // Paths
    const workspaceRoot = path.resolve(__dirname, '../..');
    const discoveryOutputDir = path.join(workspaceRoot, 'discovery-output-real');
    const madisonPath = path.join(discoveryOutputDir, 'Madison_Real.interview.json');
    const evidenceOutputDir = path.join(workspaceRoot, 'evidence-output');

    console.log('Configuration:');
    console.log(`  Discovery Input: ${madisonPath}`);
    console.log(`  Evidence Output: ${evidenceOutputDir}`);
    console.log();

    // Check input file exists
    try {
      await fs.access(madisonPath);
    } catch {
      console.error(`✗ Discovery file not found: ${madisonPath}`);
      console.error('Please run Stage 1 Discovery Engine first.');
      process.exit(1);
    }

    // Create pipeline
    const pipeline = new EvidenceIRPipeline({
      compilerVersion: '2.0.0',
      outputDirectory: evidenceOutputDir,
      saveArtifacts: true,
      verbose: true,
      prettyPrintJSON: true,
    });

    console.log('Stage 2 Compiler: Processing...');
    console.log();

    // Load discovery
    const discovery = await pipeline.loadDiscoveryJSON(madisonPath);

    // Compile
    const result = await pipeline.compileInterview(discovery);

    // Results
    console.log();
    console.log('='.repeat(70));
    console.log('COMPILATION RESULTS');
    console.log('='.repeat(70));
    console.log();

    console.log(`Status: ${result.success ? '✓ SUCCESS' : '✗ FAILED'}`);
    console.log();

    console.log('Statistics:');
    console.log(`  - Items Processed: ${result.statistics.itemsProcessed}`);
    console.log(`  - Items Successful: ${result.statistics.itemsSuccessful}`);
    console.log(`  - Items Failed: ${result.statistics.itemsFailed}`);
    console.log(`  - Execution Time: ${result.statistics.executionTimeMs}ms`);
    console.log();

    if (result.evidenceSet) {
      console.log('Evidence Set:');
      console.log(`  - Identity: ${result.evidenceSet.metadata.identity}`);
      console.log(`  - Total Items: ${result.evidenceSet.allItems.length}`);
      console.log(`  - Collections: ${result.evidenceSet.collections.length}`);
      console.log(`  - Packages: ${result.evidenceSet.packages.length}`);
      console.log(`  - Duplicates Removed: ${result.evidenceSet.crossReferences.duplicatesRemoved}`);
      console.log();
    }

    if (result.manifest) {
      console.log('Validation:');
      console.log(`  - Validations: ${result.manifest.validationSummary.totalValidations}`);
      console.log(`  - Passed: ${result.manifest.validationSummary.passedValidations}`);
      console.log(`  - Failed: ${result.manifest.validationSummary.failedValidations}`);
      console.log();
    }

    console.log('Diagnostics Summary:');
    const diagnosticsByCode = new Map<string, number>();
    for (const diag of result.diagnostics) {
      const count = diagnosticsByCode.get(diag.code) || 0;
      diagnosticsByCode.set(diag.code, count + 1);
    }

    for (const [code, count] of diagnosticsByCode) {
      console.log(`  - ${code}: ${count}`);
    }
    console.log();

    // Determinism verification
    console.log('Determinism Verification:');
    const determinism = await pipeline.verifyDeterminism(discovery);
    console.log(`  - Is Deterministic: ${determinism.isDeterministic ? '✓ YES' : '✗ NO'}`);
    if (determinism.differences.length > 0) {
      for (const diff of determinism.differences) {
        console.log(`    - ${diff}`);
      }
    }
    console.log();

    // Certification
    console.log('Certification:');
    const certification = pipeline.generateCertificationReport([result], determinism.isDeterministic);
    console.log(certification);
    console.log();

    // Save certification report
    const participantName = discovery.participant || 'Unknown';
    const certPath = path.join(evidenceOutputDir, participantName, 'EVIDENCE_IR_STAGE_2_VALIDATION.md');
    await fs.writeFile(certPath, certification);
    console.log(`✓ Certification report saved: ${certPath}`);
    console.log();

    console.log('='.repeat(70));
    console.log('PROCESSING COMPLETE');
    console.log('='.repeat(70));
  } catch (error) {
    console.error();
    console.error('='.repeat(70));
    console.error('PROCESSING FAILED');
    console.error('='.repeat(70));
    console.error();
    console.error('Error:', error instanceof Error ? error.message : String(error));
    console.error();
    if (error instanceof Error && error.stack) {
      console.error('Stack:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
