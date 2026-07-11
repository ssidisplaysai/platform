import fs from 'fs';
import path from 'path';
import { InterviewStructureParser, JsonDiscoveryExporter, DiscoveryValidator } from './index.js';

// Read Madison's real interview
const interviewPath = path.join(process.cwd(), 'discovery-interviews', 'MADISON_DISCOVERY_INTERVIEW.txt');
const interviewContent = fs.readFileSync(interviewPath, 'utf-8');

console.log('═══════════════════════════════════════════════════════════════════════════════');
console.log('        PROCESSING MADISON\'S REAL DISCOVERY INTERVIEW - GENESIS ENGINE');
console.log('═══════════════════════════════════════════════════════════════════════════════\n');

console.log(`Input: MADISON_DISCOVERY_INTERVIEW.txt`);
console.log(`Size: ${interviewContent.length.toLocaleString()} characters\n`);

// Create document manually with proper structure
const sourceId = 'src_madison_real_discovery_interview';
const document = {
  sourceId,
  sourceType: 'text' as const,
  fileName: 'MADISON_DISCOVERY_INTERVIEW.txt',
  pageCount: 1,
  metadata: {
    title: 'MADISON — Discovery Questions',
    author: 'Robert Stoner'
  },
  pages: [
    {
      pageNumber: 1,
      text: interviewContent,
      blocks: [],
      isEmpty: false
    }
  ],
  diagnostics: []
};

// Classify blocks
const parser = new InterviewStructureParser();
const lines = interviewContent.split('\n');
let currentBlock = { type: 'paragraph' as const, text: '', raw: '' };
const blocks: any[] = [];

for (const line of lines) {
  const trimmed = line.trim();

  if (!trimmed) {
    if (currentBlock.text.trim()) {
      blocks.push({
        type: currentBlock.type,
        text: currentBlock.text.trim(),
        raw: currentBlock.raw.trim(),
        pageNumber: 1
      });
      currentBlock = { type: 'paragraph', text: '', raw: '' };
    }
    continue;
  }

  // Detect block types
  if (trimmed.match(/^[A-Z][A-Z\s—]+$/) && trimmed.length > 10) {
    if (currentBlock.text.trim()) {
      blocks.push({
        type: currentBlock.type,
        text: currentBlock.text.trim(),
        raw: currentBlock.raw.trim(),
        pageNumber: 1
      });
    }
    currentBlock = { type: 'heading', text: trimmed, raw: line };
    blocks.push({
      type: 'heading',
      text: trimmed,
      raw: line,
      pageNumber: 1
    });
    currentBlock = { type: 'paragraph', text: '', raw: '' };
  } else if (trimmed.match(/^What|^Is there|^How|^List|^When|^Do you/) && trimmed.endsWith('?')) {
    if (currentBlock.text.trim()) {
      blocks.push({
        type: currentBlock.type,
        text: currentBlock.text.trim(),
        raw: currentBlock.raw.trim(),
        pageNumber: 1
      });
    }
    blocks.push({
      type: 'question',
      text: trimmed,
      raw: line,
      pageNumber: 1
    });
    currentBlock = { type: 'paragraph', text: '', raw: '' };
  } else {
    if (currentBlock.type === 'paragraph') {
      currentBlock.text += (currentBlock.text ? '\n' : '') + trimmed;
      currentBlock.raw += (currentBlock.raw ? '\n' : '') + line;
    } else {
      currentBlock.text += (currentBlock.text ? '\n' : '') + trimmed;
      currentBlock.raw += (currentBlock.raw ? '\n' : '') + line;
    }
  }
}

if (currentBlock.text.trim()) {
  blocks.push({
    type: currentBlock.type,
    text: currentBlock.text.trim(),
    raw: currentBlock.raw.trim(),
    pageNumber: 1
  });
}

document.pages[0].blocks = blocks;

console.log(`Document prepared:`);
console.log(`  - Pages: 1`);
console.log(`  - Blocks: ${blocks.length}`);
console.log(`  - Text length: ${document.pages[0].text.length} characters\n`);

// Parse interview
const interview = parser.parseInterview(document);

const totalQuestions = interview.sections.reduce((n, s) => n + s.questions.length, 0);

console.log(`Interview extracted:`);
console.log(`  - ID: ${interview.interviewId}`);
console.log(`  - Participant: ${interview.participant}`);
console.log(`  - Role: ${interview.role}`);
console.log(`  - Sections: ${interview.sections.length}`);
console.log(`  - Questions: ${totalQuestions}\n`);

console.log(`Sections breakdown:`);
for (const section of interview.sections) {
  console.log(`  ${section.order}. ${section.title}: ${section.questions.length} questions`);
}

// Validate
console.log('\n───────────────────────────────────────────────────────────────────────────────');
console.log('VALIDATION');
console.log('───────────────────────────────────────────────────────────────────────────────\n');

const validator = new DiscoveryValidator();
const validationResult = validator.validate(document, interview);

console.log(`Result: ${validationResult.valid ? '✓ VALID' : '✗ INVALID'}`);
console.log(`Errors: ${validationResult.errors.length}`);
console.log(`Warnings: ${validationResult.warnings.length}\n`);

if (validationResult.errors.length > 0) {
  console.log('ERRORS:');
  for (const err of validationResult.errors) {
    console.log(`  • ${err.message}`);
  }
}

if (validationResult.warnings.length > 0) {
  console.log('WARNINGS:');
  for (const warn of validationResult.warnings) {
    console.log(`  • ${warn.message}`);
  }
}

// Export JSON
console.log('\n───────────────────────────────────────────────────────────────────────────────');
console.log('EXPORTING JSON');
console.log('───────────────────────────────────────────────────────────────────────────────\n');

const outputDir = path.join(process.cwd(), 'discovery-output-real');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const exporter = new JsonDiscoveryExporter();

// Document JSON
const docJson = exporter.exportDocument(document);
const docPath = path.join(outputDir, 'Madison_Real.document.json');
fs.writeFileSync(docPath, docJson.content);
console.log(`✓ Madison_Real.document.json (${docJson.content.length.toLocaleString()} bytes)`);

// Interview JSON
const intJson = exporter.exportInterview(interview);
const intPath = path.join(outputDir, 'Madison_Real.interview.json');
fs.writeFileSync(intPath, intJson.content);
console.log(`✓ Madison_Real.interview.json (${intJson.content.length.toLocaleString()} bytes)`);

// Result JSON
const resultJson = exporter.exportResult({
  success: validationResult.valid,
  timestamp: new Date().toISOString(),
  source: {
    sourceId,
    sourceType: 'text',
    fileName: 'MADISON_DISCOVERY_INTERVIEW.txt',
    filePath: interviewPath,
    fileSize: interviewContent.length,
    mimeType: 'text/plain',
    importedAt: new Date().toISOString()
  },
  document,
  interview,
  validation: validationResult,
  diagnostics: []
} as any);

const resPath = path.join(outputDir, 'Madison_Real.result.json');
fs.writeFileSync(resPath, resultJson.content);
console.log(`✓ Madison_Real.result.json (${resultJson.content.length.toLocaleString()} bytes)`);

console.log('\n═══════════════════════════════════════════════════════════════════════════════');
console.log('✓ REAL INTERVIEW PROCESSING COMPLETE');
console.log('═══════════════════════════════════════════════════════════════════════════════\n');

console.log(`Output directory: ${outputDir}\n`);
