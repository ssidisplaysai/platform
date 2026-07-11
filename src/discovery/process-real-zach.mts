import fs from 'fs';
import path from 'path';
import { DiscoveryPipeline, JsonDiscoveryExporter } from '../src/discovery/index.js';

// Read Zach's real interview
const interviewPath = path.join(process.cwd(), 'discovery-interviews', 'ZACH_ANDERSON_DISCOVERY_INTERVIEW.txt');
const interviewContent = fs.readFileSync(interviewPath, 'utf-8');

console.log('═══════════════════════════════════════════════════════════════════════════════');
console.log('           GENESIS DISCOVERY ENGINE - REAL INTERVIEW PROCESSING');
console.log('═══════════════════════════════════════════════════════════════════════════════\n');

console.log('Processing: ZACH_ANDERSON_DISCOVERY_INTERVIEW.txt');
console.log(`Size: ${interviewContent.length} characters\n`);

// Create a simulated PDF buffer from the text content
// For this, we'll treat the text as raw content that can be processed
const buffer = Buffer.from(interviewContent, 'utf-8');

// Create pipeline
const pipeline = new DiscoveryPipeline();

// Import the content
const result = await pipeline.importBuffer(
  buffer,
  'ZACH_ANDERSON_DISCOVERY_INTERVIEW.pdf',
  interviewPath
);

console.log('IMPORT RESULT:');
console.log('───────────────────────────────────────────────────────────────────────────────');
console.log(`Success: ${result.success}`);
console.log(`Timestamp: ${result.timestamp}`);
console.log(`Source ID: ${result.source?.sourceId}`);

if (result.document) {
  console.log(`\nDocument:
  - Pages: ${result.document.pages.length}
  - Blocks: ${result.document.pages.reduce((n, p) => n + p.blocks.length, 0)}
  - Page count metadata: ${result.document.pageCount}`);
}

if (result.interview) {
  const totalQuestions = result.interview.sections.reduce((n, s) => n + s.questions.length, 0);
  console.log(`\nInterview:
  - Interview ID: ${result.interview.interviewId}
  - Participant: ${result.interview.participant}
  - Role: ${result.interview.role}
  - Department: ${result.interview.department}
  - Date: ${result.interview.interviewDate}
  - Interviewer: ${result.interview.interviewer}
  - Sections: ${result.interview.sections.length}
  - Total Questions: ${totalQuestions}`);

  // Show section breakdown
  console.log('\nSections:');
  for (const section of result.interview.sections) {
    console.log(`  ${section.order}. ${section.title}: ${section.questions.length} questions`);
  }

  // Show first 3 questions as samples
  console.log('\nSample Questions:');
  let qNum = 1;
  for (const section of result.interview.sections) {
    for (const q of section.questions.slice(0, 1)) {
      console.log(`\n  Q${qNum}. ${q.question.substring(0, 60)}...`);
      console.log(`      Answer: ${q.answer.substring(0, 60)}...`);
      qNum++;
    }
  }
}

if (result.validation) {
  console.log(`\nValidation:
  - Valid: ${result.validation.valid}
  - Errors: ${result.validation.errors.length}
  - Warnings: ${result.validation.warnings.length}
  - Infos: ${result.validation.infos.length}`);

  if (result.validation.errors.length > 0) {
    console.log('  Errors:');
    for (const err of result.validation.errors) {
      console.log(`    - [${err.code}] ${err.message}`);
    }
  }
}

// Export to JSON files
const exporter = new JsonDiscoveryExporter();
const outputDir = path.join(process.cwd(), 'discovery-output-real');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('\n═══════════════════════════════════════════════════════════════════════════════');
console.log('EXPORTING JSON FILES');
console.log('───────────────────────────────────────────────────────────────────────────────\n');

// Export document
if (result.document) {
  const docOutput = exporter.exportDocument(result.document);
  const docPath = path.join(outputDir, `Zach_Real.document.json`);
  fs.writeFileSync(docPath, docOutput.content);
  console.log(`✓ Document JSON: ${docPath} (${docOutput.content.length} bytes)`);
}

// Export interview
if (result.interview) {
  const intOutput = exporter.exportInterview(result.interview);
  const intPath = path.join(outputDir, `Zach_Real.interview.json`);
  fs.writeFileSync(intPath, intOutput.content);
  console.log(`✓ Interview JSON: ${intPath} (${intOutput.content.length} bytes)`);
}

// Export complete result
const resOutput = exporter.exportResult(result);
const resPath = path.join(outputDir, `Zach_Real.result.json`);
fs.writeFileSync(resPath, resOutput.content);
console.log(`✓ Result JSON: ${resPath} (${resOutput.content.length} bytes)`);

console.log('\n═══════════════════════════════════════════════════════════════════════════════');
console.log('REAL INTERVIEW PROCESSING COMPLETE');
console.log('═══════════════════════════════════════════════════════════════════════════════\n');

// Verify JSON files are valid
console.log('VERIFYING JSON FILES:');
console.log('───────────────────────────────────────────────────────────────────────────────\n');

const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.json'));
let allValid = true;

for (const file of files) {
  const filePath = path.join(outputDir, file);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    console.log(`✓ ${file} (${content.length} bytes)`);
  } catch (e) {
    console.log(`✗ ${file} - INVALID JSON`);
    allValid = false;
  }
}

console.log(`\n${allValid ? '✓ All files valid' : '✗ Some files invalid'}`);
console.log('\nOutput directory: ' + outputDir);
