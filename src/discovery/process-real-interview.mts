import fs from 'fs';
import path from 'path';
import { InterviewStructureParser, JsonDiscoveryExporter, DiscoveryValidator, DiagnosticsCollector } from './index.js';

// Read Zach's real interview
const interviewPath = path.join(process.cwd(), 'discovery-interviews', 'ZACH_ANDERSON_DISCOVERY_INTERVIEW.txt');
const interviewContent = fs.readFileSync(interviewPath, 'utf-8');

console.log('═══════════════════════════════════════════════════════════════════════════════');
console.log('           PROCESSING ZACH\'S REAL DISCOVERY INTERVIEW');
console.log('═══════════════════════════════════════════════════════════════════════════════\n');

console.log('Input File: ZACH_ANDERSON_DISCOVERY_INTERVIEW.txt');
console.log(`Content Length: ${interviewContent.length} characters\n`);

// Parse document structure
const diagnostics = new DiagnosticsCollector();
const parser = new InterviewStructureParser();

const document = parser.parseDocument(
  interviewContent,
  'src_zach_real_discovery_interview',
  'text'
);
console.log('Document parsed:');
console.log(`  - Pages: ${document.pages.length}`);
console.log(`  - Total blocks: ${document.pages.reduce((n, p) => n + p.blocks.length, 0)}`);
console.log(`  - Text preserved: ${document.pages.reduce((n, p) => n + p.text.length, 0)} characters\n`);

// Parse interview structure
const interview = parser.parseInterview(document);

console.log('Interview extracted:');
console.log(`  - ID: ${interview.interviewId}`);
console.log(`  - Participant: ${interview.participant}`);
console.log(`  - Role: ${interview.role}`);
console.log(`  - Department: ${interview.department}`);
console.log(`  - Date: ${interview.interviewDate}`);
console.log(`  - Interviewer: ${interview.interviewer}`);
console.log(`  - Sections: ${interview.sections.length}`);

const totalQuestions = interview.sections.reduce((n, s) => n + s.questions.length, 0);
console.log(`  - Total Questions: ${totalQuestions}\n`);

// Show section breakdown
console.log('Sections:');
for (const section of interview.sections) {
  console.log(`  ${section.order}. ${section.title}`);
  console.log(`     ${section.questions.length} questions`);
}

// Validate
console.log('\n───────────────────────────────────────────────────────────────────────────────');
console.log('VALIDATION');
console.log('───────────────────────────────────────────────────────────────────────────────\n');

const validator = new DiscoveryValidator();
const validationResult = validator.validate(document, interview);

console.log(`Valid: ${validationResult.valid}`);
console.log(`Errors: ${validationResult.errors.length}`);
console.log(`Warnings: ${validationResult.warnings.length}`);
console.log(`Infos: ${validationResult.infos.length}\n`);

if (validationResult.errors.length > 0) {
  console.log('ERRORS:');
  for (const err of validationResult.errors) {
    console.log(`  [${err.code}] ${err.message}`);
  }
}

if (validationResult.warnings.length > 0) {
  console.log('WARNINGS:');
  for (const warn of validationResult.warnings) {
    console.log(`  [${warn.code}] ${warn.message}`);
  }
}

// Export to JSON
console.log('\n───────────────────────────────────────────────────────────────────────────────');
console.log('EXPORTING JSON');
console.log('───────────────────────────────────────────────────────────────────────────────\n');

const outputDir = path.join(process.cwd(), 'discovery-output-real');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const exporter = new JsonDiscoveryExporter();

// Export document
const docOutput = exporter.exportDocument(document);
const docPath = path.join(outputDir, 'Zach_Real_Discovery_Interview.document.json');
fs.writeFileSync(docPath, docOutput.content);
console.log(`✓ Document JSON: ${path.basename(docPath)}`);
console.log(`  Size: ${docOutput.content.length.toLocaleString()} bytes`);

// Export interview
const intOutput = exporter.exportInterview(interview);
const intPath = path.join(outputDir, 'Zach_Real_Discovery_Interview.interview.json');
fs.writeFileSync(intPath, intOutput.content);
console.log(`✓ Interview JSON: ${path.basename(intPath)}`);
console.log(`  Size: ${intOutput.content.length.toLocaleString()} bytes`);

// Export result (combining all)
const resultData = {
  success: validationResult.valid,
  timestamp: new Date().toISOString(),
  source: {
    sourceId: document.sourceId,
    sourceType: 'text',
    fileName: 'ZACH_ANDERSON_DISCOVERY_INTERVIEW.txt',
    filePath: interviewPath,
    fileSize: interviewContent.length,
    mimeType: 'text/plain',
    importedAt: new Date().toISOString()
  },
  document,
  interview,
  validation: validationResult,
  diagnostics: []
};

const resOutput = exporter.exportResult(resultData as any);
const resPath = path.join(outputDir, 'Zach_Real_Discovery_Interview.result.json');
fs.writeFileSync(resPath, resOutput.content);
console.log(`✓ Result JSON: ${path.basename(resPath)}`);
console.log(`  Size: ${resOutput.content.length.toLocaleString()} bytes`);

console.log('\n═══════════════════════════════════════════════════════════════════════════════');
console.log('REAL INTERVIEW PROCESSING COMPLETE');
console.log('═══════════════════════════════════════════════════════════════════════════════\n');

// Verify files
console.log('VERIFICATION:');
console.log('───────────────────────────────────────────────────────────────────────────────\n');

const files = fs.readdirSync(outputDir).filter(f => f.startsWith('Zach_Real') && f.endsWith('.json'));
for (const file of files) {
  const filePath = path.join(outputDir, file);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    JSON.parse(content);
    console.log(`✓ ${file} - VALID`);
  } catch (e) {
    console.log(`✗ ${file} - INVALID`);
  }
}

console.log(`\nOutput Directory: ${outputDir}`);
console.log(`Total files: ${files.length}`);
console.log('\n✓ PROCESSING COMPLETE\n');
