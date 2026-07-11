#!/usr/bin/env node
/**
 * Genesis Discovery Engine — CLI Runner
 *
 * Usage:
 *   node discovery-import.mjs <path/to/interview.pdf> [--output <dir>]
 *   node discovery-import.mjs <file1.pdf> <file2.pdf> --output ./out
 *
 * Outputs:
 *   <output>/<baseName>.document.json   — DiscoveryDocument
 *   <output>/<baseName>.interview.json  — DiscoveryInterview
 *   <output>/<baseName>.result.json     — Full DiscoveryImportResult
 *
 * Exit codes:
 *   0 — all imports succeeded
 *   1 — one or more imports failed (errors in diagnostics)
 *   2 — CLI argument error
 */

import { createRequire } from 'module';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible require for CJS modules.
const require = createRequire(import.meta.url);

// We need to load the TypeScript source via a register hook or pre-compiled.
// For this CLI we use tsx (or ts-node) if available, otherwise require compiled JS.
// The CLI is designed to run via: npx tsx src/discovery/discovery-import.mjs

// Dynamic import of the compiled discovery module.
// When running with tsx, TypeScript files are resolved directly.
const { DiscoveryPipeline, JsonDiscoveryExporter } = await import('./index.ts');

// ---------------------------------------------------------------------------
// Parse CLI arguments
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`
Genesis Discovery Engine — Import CLI

Usage:
  npx tsx src/discovery/discovery-import.mjs <file.pdf> [<file2.pdf>...] [--output <dir>]

Options:
  --output <dir>   Output directory for JSON files (default: ./discovery-output)
  --help, -h       Show this help

Examples:
  npx tsx src/discovery/discovery-import.mjs "Zach Discovery Interview.pdf"
  npx tsx src/discovery/discovery-import.mjs "Zach.pdf" "Madison.pdf" --output ./out
`);
  process.exit(0);
}

// Collect file paths and options.
const filePaths = [];
let outputDir = './discovery-output';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--output' || args[i] === '-o') {
    outputDir = args[++i];
  } else if (!args[i].startsWith('--')) {
    filePaths.push(args[i]);
  }
}

if (filePaths.length === 0) {
  console.error('Error: No input files specified.');
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Ensure output directory exists
// ---------------------------------------------------------------------------

if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
  console.log(`Created output directory: ${outputDir}`);
}

// ---------------------------------------------------------------------------
// Run pipeline
// ---------------------------------------------------------------------------

const pipeline = new DiscoveryPipeline();
const exporter = new JsonDiscoveryExporter();

console.log(`\nGenesis Discovery Engine — Import Pipeline`);
console.log(`${'─'.repeat(60)}`);
console.log(`Processing ${filePaths.length} file(s)...\n`);

let anyFailed = false;

for (const filePath of filePaths) {
  console.log(`► ${filePath}`);

  const result = await pipeline.importFile(filePath);
  const fileBase = basename(filePath, '.pdf').replace(/\s+/g, '-').toLowerCase();

  // Write DiscoveryDocument.
  if (result.document) {
    const docOutput = exporter.exportDocument(result.document);
    const docPath = join(outputDir, `${fileBase}.document.${docOutput.extension}`);
    writeFileSync(docPath, docOutput.content, 'utf-8');
    console.log(`  ✓ Document  → ${docPath}`);
  }

  // Write DiscoveryInterview.
  if (result.interview) {
    const ivOutput = exporter.exportInterview(result.interview);
    const ivPath = join(outputDir, `${fileBase}.interview.${ivOutput.extension}`);
    writeFileSync(ivPath, ivOutput.content, 'utf-8');
    console.log(`  ✓ Interview → ${ivPath}`);
  }

  // Write full result.
  const resultOutput = exporter.exportResult(result);
  const resultPath = join(outputDir, `${fileBase}.result.${resultOutput.extension}`);
  writeFileSync(resultPath, resultOutput.content, 'utf-8');
  console.log(`  ✓ Result    → ${resultPath}`);

  // Print diagnostics summary.
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  const warnings = result.diagnostics.filter((d) => d.severity === 'warning');

  if (errors.length > 0) {
    anyFailed = true;
    console.log(`\n  ✗ FAILED — ${errors.length} error(s):`);
    for (const e of errors) {
      console.log(`    [${e.code}] ${e.message}`);
    }
  } else if (warnings.length > 0) {
    console.log(`\n  ⚠ ${warnings.length} warning(s):`);
    for (const w of warnings) {
      console.log(`    [${w.code}] ${w.message}`);
    }
  } else {
    console.log(`\n  ✓ Import complete. No issues.`);
  }

  if (result.interview) {
    const { participant, role, sections } = result.interview;
    const totalQ = sections.reduce((n, s) => n + s.questions.length, 0);
    console.log(`\n  Interview summary:`);
    console.log(`    Participant : ${participant}`);
    console.log(`    Role        : ${role || '(not detected)'}`);
    console.log(`    Sections    : ${sections.length}`);
    console.log(`    Questions   : ${totalQ}`);
  }

  console.log('');
}

console.log(`${'─'.repeat(60)}`);
console.log(anyFailed ? `✗ Done with errors.` : `✓ All imports complete.`);

process.exit(anyFailed ? 1 : 0);
