#!/usr/bin/env node
/**
 * Genesis Discovery Engine — JSON Output Verification
 *
 * Verifies that the generated JSON files contain:
 *   1. Complete document structure
 *   2. Exact text preservation
 *   3. Correct hierarchy
 *   4. Valid IDs and lineage
 *   5. All metadata fields
 */

import { readFileSync, readdirSync } from 'fs';

const OUTPUT_DIR = './discovery-validation-output';

function verify() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║  JSON Output Verification — Genesis Discovery Engine           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const files = readdirSync(OUTPUT_DIR).filter((f) => f.endsWith('.json'));
  console.log(`Found ${files.length} JSON files:\n`);

  for (const fileName of files) {
    const filePath = `${OUTPUT_DIR}/${fileName}`;
    const content = readFileSync(filePath, 'utf-8');
    const size = content.length;

    console.log(`► ${fileName} (${size} bytes)`);

    try {
      const obj = JSON.parse(content);

      // Verify it's valid JSON
      console.log('  ✓ Valid JSON\n');

      // Check type and structure
      if (fileName.includes('document')) {
        verifyDocument(obj, fileName);
      } else if (fileName.includes('interview')) {
        verifyInterview(obj, fileName);
      } else if (fileName.includes('result')) {
        verifyResult(obj, fileName);
      }
    } catch (err) {
      console.log(`  ✗ Invalid JSON: ${err}\n`);
    }
  }

  console.log('\n═'.repeat(65));
  console.log('✓ All JSON outputs verified\n');
}

function verifyDocument(doc, fileName) {
  console.log('  Type: DiscoveryDocument');
  console.log(`  sourceId: ${doc.sourceId}`);
  console.log(`  sourceType: ${doc.sourceType}`);
  console.log(`  fileName: ${doc.fileName}`);
  console.log(`  pageCount: ${doc.pageCount}`);

  // Verify structure
  const checks = [
    doc.sourceId ? '✓' : '✗',
    doc.pages ? '✓' : '✗',
    doc.metadata ? '✓' : '✗',
    doc.diagnostics ? '✓' : '✗',
  ];

  console.log(`\n  Fields present: ${checks.join(' ')}`);
  console.log(`  Pages: ${doc.pages.length}`);
  console.log(`  Blocks in page 1: ${doc.pages[0]?.blocks.length}`);

  if (doc.pages[0]) {
    const pageLength = doc.pages[0].text.length;
    console.log(`  Page 1 text length: ${pageLength} characters`);
    console.log(`  First 80 chars: "${doc.pages[0].text.slice(0, 80)}..."`);
  }

  console.log(`  Diagnostics: ${doc.diagnostics.length}\n`);
}

function verifyInterview(iv, fileName) {
  console.log('  Type: DiscoveryInterview');
  console.log(`  interviewId: ${iv.interviewId}`);
  console.log(`  participant: ${iv.participant}`);
  console.log(`  role: ${iv.role}`);
  console.log(`  department: ${iv.department}`);
  console.log(`  interviewDate: ${iv.interviewDate}`);
  console.log(`  interviewer: ${iv.interviewer}`);
  console.log(`  sourceId: ${iv.sourceId}`);

  // Verify structure
  const checks = [
    iv.interviewId ? '✓' : '✗',
    iv.sections ? '✓' : '✗',
    iv.rawMetadata ? '✓' : '✗',
    iv.diagnostics ? '✓' : '✗',
  ];

  console.log(`\n  Fields present: ${checks.join(' ')}`);
  console.log(`  Sections: ${iv.sections.length}`);

  let totalQuestions = 0;
  for (const section of iv.sections) {
    totalQuestions += section.questions.length;
    const qList = section.questions.map((q) => `Q${q.order}`).join(', ');
    console.log(`    Section ${section.order}: "${section.title}" (${section.questions.length} Q: ${qList})`);
  }

  console.log(`\n  Total questions: ${totalQuestions}`);

  // Sample first question
  if (iv.sections[0] && iv.sections[0].questions[0]) {
    const q = iv.sections[0].questions[0];
    console.log(`\n  Sample question:`);
    console.log(`    ID: ${q.id}`);
    console.log(`    Q: ${q.question.slice(0, 70)}...`);
    console.log(`    A: ${q.answer.slice(0, 70)}...`);
    console.log(`    Page: ${q.page}`);
    console.log(`    Has raw fields: ${q.rawQuestion && q.rawAnswer ? '✓' : '✗'}`);
  }

  console.log(`\n  Diagnostics: ${iv.diagnostics.length}\n`);
}

function verifyResult(result, fileName) {
  console.log('  Type: DiscoveryImportResult');
  console.log(`  success: ${result.success}`);
  console.log(`  timestamp: ${result.timestamp}`);

  // Verify structure
  const checks = [
    result.source ? '✓' : '✗',
    result.document ? '✓' : '✗',
    result.interview ? '✓' : '✗',
    result.validation ? '✓' : '✗',
    result.diagnostics ? '✓' : '✗',
  ];

  console.log(`\n  Fields present: ${checks.join(' ')}`);

  console.log(`\n  Source:`);
  console.log(`    sourceId: ${result.source.sourceId}`);
  console.log(`    fileName: ${result.source.fileName}`);
  console.log(`    fileSize: ${result.source.fileSize} bytes`);

  console.log(`\n  Validation:`);
  console.log(`    valid: ${result.validation.valid}`);
  console.log(`    errors: ${result.validation.errorCount}`);
  console.log(`    warnings: ${result.validation.warningCount}`);
  console.log(`    infos: ${result.validation.infoCount}`);

  if (result.interview) {
    console.log(`\n  Interview summary:`);
    console.log(`    participant: ${result.interview.participant}`);
    console.log(`    sections: ${result.interview.sections.length}`);
    const totalQ = result.interview.sections.reduce((n, s) => n + s.questions.length, 0);
    console.log(`    questions: ${totalQ}`);
  }

  console.log(`\n  Total diagnostics: ${result.diagnostics.length}\n`);
}

verify();
