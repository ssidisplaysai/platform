/**
 * validateModules command
 *
 * Validates generated module manifests for correctness and completeness.
 *
 * Usage:
 *   node tools/genesis/genesis.mjs validate modules
 *
 * Output:
 *   - Validation results for each module
 *   - Summary of errors and warnings
 *
 * @module tools/genesis/commands/validateModules
 */

import fs from 'fs';
import path from 'path';
import { ModuleManifestValidator } from '../compiler/validators/ModuleManifestValidator.mjs';

export async function runValidateModulesCommand(options = []) {
  const modulesDir = path.join(process.cwd(), 'out', 'generated', 'modules');

  if (!fs.existsSync(modulesDir)) {
    console.error(`\n✗ Module manifests directory not found: ${modulesDir}`);
    console.error('Have you run: node tools/genesis/genesis.mjs compile modules ?');
    process.exit(1);
  }

  console.log('🔍 Genesis Module Validator - Starting module validation...\n');

  const validator = new ModuleManifestValidator();
  let totalValid = 0;
  let totalInvalid = 0;
  const allResults = [];

  // Find all module manifests recursively
  const findModuleManifests = (dir) => {
    const files = [];
    const entries = fs.readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        files.push(...findModuleManifests(fullPath));
      } else if (entry.endsWith('.module.json') && entry !== 'module-registry.json') {
        files.push(fullPath);
      }
    }
    
    return files;
  };

  const manifestFiles = findModuleManifests(modulesDir);

  if (manifestFiles.length === 0) {
    console.warn('No module manifests found to validate.');
    return;
  }

  for (const manifestPath of manifestFiles) {
    const file = path.relative(modulesDir, manifestPath);
    const result = validator.validateManifest(manifestPath);

    if (result.valid) {
      console.log(`  ✓ ${file}`);
      totalValid += 1;
    } else {
      console.log(`  ✗ ${file}`);
      for (const error of result.errors) {
        console.log(`    - ERROR: ${error}`);
      }
      for (const warning of result.warnings) {
        console.log(`    - WARNING: ${warning}`);
      }
      totalInvalid += 1;
    }

    allResults.push({
      file,
      result
    });
  }

  // Validate module registry
  const registryPath = path.join(modulesDir, 'module-registry.json');
  if (fs.existsSync(registryPath)) {
    const registryValidator = new ModuleManifestValidator();
    const registryResult = registryValidator.validateManifest(registryPath);

    console.log(`\n  Module Registry: module-registry.json`);
    if (registryResult.valid) {
      console.log(`    ✓ Valid`);
    } else {
      console.log(`    ✗ Invalid`);
      for (const error of registryResult.errors) {
        console.log(`      - ERROR: ${error}`);
      }
    }
  }

  // Print summary
  console.log('\n' + '═'.repeat(70));
  console.log('VALIDATION SUMMARY');
  console.log('═'.repeat(70));
  console.log(`\n  Valid: ${totalValid}`);
  console.log(`  Invalid: ${totalInvalid}`);
  console.log(`  Total: ${totalValid + totalInvalid}`);

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const r of allResults) {
    totalErrors += r.result.errorCount;
    totalWarnings += r.result.warningCount;
  }

  if (totalErrors > 0) {
    console.log(`\n  Errors: ${totalErrors}`);
  }

  if (totalWarnings > 0) {
    console.log(`  Warnings: ${totalWarnings}`);
  }

  console.log('\n' + '═'.repeat(70));

  if (totalInvalid > 0 || totalErrors > 0) {
    process.exit(1);
  }
}
