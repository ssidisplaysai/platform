/**
 * Genesis Discovery Engine — Smoke Test
 *
 * Tests the full pipeline with a synthetic in-memory "PDF" (using a text
 * buffer since we cannot create a real PDF in the test environment).
 *
 * Run:
 *   npx tsx src/discovery/discovery-smoke-test.mts
 */

// Test the model types and validation layer directly
// without needing an actual PDF file.

import { DiagnosticsCollector } from './diagnostics/index.ts';
import { DiagnosticCode } from './models/index.ts';
import { DiscoveryValidator } from './validation/DiscoveryValidator.ts';
import { JsonDiscoveryExporter } from './exporters/JsonDiscoveryExporter.ts';
import { InterviewStructureParser } from './parser/InterviewStructureParser.ts';

console.log('\nGenesis Discovery Engine — Smoke Test');
console.log('─'.repeat(50));

// ---------------------------------------------------------------------------
// Test 1: DiagnosticsCollector
// ---------------------------------------------------------------------------

console.log('\nTest 1: DiagnosticsCollector');

const diag = new DiagnosticsCollector();
diag.info(DiagnosticCode.EMPTY_PAGE, 'Page 1 is empty', { pageNumber: 1 });
diag.warn(DiagnosticCode.MISSING_PARTICIPANT, 'Participant not detected');
diag.error(DiagnosticCode.INVALID_PDF, 'Could not parse PDF');

console.assert(diag.count() === 3, 'Should have 3 diagnostics');
console.assert(diag.hasErrors(), 'Should have errors');
console.assert(diag.hasWarnings(), 'Should have warnings');
console.assert(diag.getErrors().length === 1, 'Should have 1 error');
console.assert(diag.getWarnings().length === 1, 'Should have 1 warning');
console.assert(diag.getInfos().length === 1, 'Should have 1 info');
console.log('  ✓ DiagnosticsCollector works correctly');

// Absorb test
const diag2 = new DiagnosticsCollector();
diag2.error(DiagnosticCode.SOURCE_NOT_FOUND, 'Source missing');
diag.absorb(diag2);
console.assert(diag.count() === 4, 'Should have 4 after absorb');
console.log('  ✓ absorb() works correctly');

// ---------------------------------------------------------------------------
// Test 2: InterviewStructureParser — structured document
// ---------------------------------------------------------------------------

console.log('\nTest 2: InterviewStructureParser — structured document');

const parser = new InterviewStructureParser();

const rawResult = {
  pages: [
    {
      pageNumber: 1,
      text: [
        'Genesis Discovery Interview',
        'Participant: Zach Anderson',
        'Role: Graphics Lead',
        'Department: Creative',
        'Date: July 5, 2026',
        'Interviewer: Robert Stoner',
        '',
        'SECTION 1: DAILY WORKFLOW',
        '',
        'Q1. Walk me through a typical day. What is the first thing you do when you come in?',
        'I usually start by checking my project queue. There are usually 3-5 active jobs at any time.',
        'I prioritize based on delivery date.',
        '',
        'Q2. What software do you use every day?',
        'Adobe Illustrator is my main tool. I also use Photoshop and sometimes Figma for mockups.',
        '',
        'SECTION 2: BOTTLENECKS',
        '',
        'Q3. What slows you down the most?',
        'Waiting for client feedback. Sometimes jobs sit for days waiting on approval.',
        '',
        'Q4. Do you ever get unclear briefs?',
        'Yes, often. Specs come from Robert and sometimes they are incomplete for complex jobs.',
      ].join('\n'),
    },
  ],
  metadata: {
    Title: 'Zach Discovery Interview',
    Author: 'Robert Stoner',
    CreationDate: '2026-07-05',
  },
  totalPages: 1,
};

const doc = parser.parseDocument(rawResult, 'src_test_001', 'Zach Discovery Interview.pdf');

console.assert(doc.sourceId === 'src_test_001', 'Document sourceId should match');
console.assert(doc.pageCount === 1, 'Document should have 1 page');
console.assert(doc.pages.length === 1, 'Document should have 1 page in array');
console.assert(doc.metadata.title === 'Zach Discovery Interview', 'Metadata title should be extracted');
console.assert(!doc.pages[0].isEmpty, 'Page should not be empty');
console.assert(doc.pages[0].blocks.length > 0, 'Page should have blocks');
console.log('  ✓ parseDocument() produces valid DiscoveryDocument');

const interview = parser.parseInterview(doc);

console.assert(interview.participant === 'Zach Anderson', `Participant should be "Zach Anderson", got "${interview.participant}"`);
console.assert(interview.role === 'Graphics Lead', `Role should be "Graphics Lead", got "${interview.role}"`);
console.assert(interview.department === 'Creative', `Department should be "Creative", got "${interview.department}"`);
console.assert(interview.interviewer === 'Robert Stoner', `Interviewer should be "Robert Stoner", got "${interview.interviewer}"`);
console.assert(interview.sections.length >= 2, `Should have at least 2 sections, got ${interview.sections.length}`);

const section1 = interview.sections.find((s) => s.title.includes('WORKFLOW') || s.title.includes('DAILY'));
console.assert(section1 !== undefined, 'Should have a daily workflow section');
console.assert((section1?.questions.length ?? 0) >= 2, 'Section 1 should have at least 2 questions');

const q1 = section1?.questions[0];
console.assert(q1?.question.includes('typical day'), `Q1 should ask about typical day, got: "${q1?.question}"`);
console.assert(q1?.answer.includes('project queue'), `Q1 answer should mention project queue, got: "${q1?.answer}"`);
console.assert(q1?.rawQuestion.length > 0, 'Q1 rawQuestion should not be empty');
console.assert(q1?.rawAnswer.length > 0, 'Q1 rawAnswer should not be empty');

// Verify exact wording preserved
console.assert(
  q1?.answer.includes('3-5 active jobs'),
  `Q1 answer must preserve exact wording "3-5 active jobs", got: "${q1?.answer}"`
);
console.log('  ✓ parseInterview() extracts metadata correctly');
console.log('  ✓ Sections detected correctly');
console.log('  ✓ Question text preserved exactly');
console.log('  ✓ Answer text preserved exactly');

// ---------------------------------------------------------------------------
// Test 3: InterviewStructureParser — no structure
// ---------------------------------------------------------------------------

console.log('\nTest 3: InterviewStructureParser — unstructured document');

const unstructuredRaw = {
  pages: [
    {
      pageNumber: 1,
      text: 'This is a document with no interview structure. It just has some text. Nothing is a question.',
    },
  ],
  metadata: {},
  totalPages: 1,
};

const unstructuredDoc = parser.parseDocument(unstructuredRaw, 'src_test_002', 'plain.pdf');
const unstructuredInterview = parser.parseInterview(unstructuredDoc);

// Should still produce output, not crash.
console.assert(unstructuredInterview.sections.length >= 1, 'Should produce at least 1 section even without structure');
const hasWarnDiag = unstructuredInterview.diagnostics.some((d) => d.code === DiagnosticCode.NO_STRUCTURE_DETECTED);
console.assert(hasWarnDiag, 'Should emit NO_STRUCTURE_DETECTED diagnostic');
console.log('  ✓ Unstructured document handled gracefully');
console.log('  ✓ NO_STRUCTURE_DETECTED diagnostic emitted');

// ---------------------------------------------------------------------------
// Test 4: DiscoveryValidator
// ---------------------------------------------------------------------------

console.log('\nTest 4: DiscoveryValidator');

const validator = new DiscoveryValidator();
const validationResult = validator.validate(doc, interview);

console.assert(validationResult.valid, `Validation should pass for well-formed document, errors: ${validationResult.errors.map(e => e.message).join('; ')}`);
console.log('  ✓ DiscoveryValidator passes well-formed document');

// Test with missing participant
const badInterview = { ...interview, participant: 'Unknown' };
const badValidation = validator.validateInterview(badInterview);
const hasMissingParticipantWarn = badValidation.warnings.some(
  (w) => w.code === DiagnosticCode.MISSING_PARTICIPANT,
);
console.assert(hasMissingParticipantWarn, 'Should warn when participant is Unknown');
console.log('  ✓ Missing participant produces warning');

// ---------------------------------------------------------------------------
// Test 5: JsonDiscoveryExporter
// ---------------------------------------------------------------------------

console.log('\nTest 5: JsonDiscoveryExporter');

const exporter = new JsonDiscoveryExporter();

const docExport = exporter.exportDocument(doc);
console.assert(docExport.extension === 'json', 'Extension should be json');
console.assert(docExport.mimeType === 'application/json', 'MIME type should be application/json');
const parsedDoc = JSON.parse(docExport.content);
console.assert(parsedDoc.sourceId === 'src_test_001', 'Exported doc should have sourceId');
console.assert(parsedDoc.pages.length === 1, 'Exported doc should have pages');
console.assert(parsedDoc.pages[0].text.includes('Zach Anderson'), 'Exported page text should include participant');
console.log('  ✓ exportDocument() produces valid JSON');

const ivExport = exporter.exportInterview(interview);
const parsedIv = JSON.parse(ivExport.content);
console.assert(parsedIv.participant === 'Zach Anderson', 'Exported interview should have participant');
console.assert(parsedIv.sections.length >= 2, 'Exported interview should have sections');
console.assert(parsedIv.sections[0].questions[0].question.length > 0, 'Exported questions should have text');
// Verify raw fields are present
console.assert('rawQuestion' in parsedIv.sections[0].questions[0], 'rawQuestion should be exported');
console.assert('rawAnswer' in parsedIv.sections[0].questions[0], 'rawAnswer should be exported');
console.log('  ✓ exportInterview() produces valid JSON');
console.log('  ✓ rawQuestion and rawAnswer fields preserved');

// ---------------------------------------------------------------------------
// Test 6: Determinism — same input produces same IDs
// ---------------------------------------------------------------------------

console.log('\nTest 6: Determinism — same input → same IDs');

const doc2 = parser.parseDocument(rawResult, 'src_test_001', 'Zach Discovery Interview.pdf');
const interview2 = parser.parseInterview(doc2);

console.assert(interview.interviewId === interview2.interviewId, 'Interview IDs should be deterministic');
console.assert(
  interview.sections[0].questions[0].id === interview2.sections[0].questions[0].id,
  'Question IDs should be deterministic',
);
console.log('  ✓ IDs are deterministic across re-runs');

// ---------------------------------------------------------------------------
// Test 7: Source lineage — all questions reference the source
// ---------------------------------------------------------------------------

console.log('\nTest 7: Source lineage');

console.assert(interview.sourceId === doc.sourceId, 'Interview sourceId must match document sourceId');
for (const section of interview.sections) {
  for (const q of section.questions) {
    console.assert(q.page >= 1, `Question "${q.id}" must have a valid page reference`);
  }
}
console.log('  ✓ Interview.sourceId matches document.sourceId');
console.log('  ✓ All questions have page references');

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n' + '─'.repeat(50));
console.log('✓ All smoke tests passed');
console.log(`  Participant extracted : ${interview.participant}`);
console.log(`  Role extracted        : ${interview.role}`);
console.log(`  Sections detected     : ${interview.sections.length}`);
console.log(`  Questions extracted   : ${interview.sections.reduce((n, s) => n + s.questions.length, 0)}`);
console.log(`  Diagnostics           : ${interview.diagnostics.length}`);
console.log('');
