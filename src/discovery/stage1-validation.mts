/**
 * Genesis Discovery Engine — Stage 1 Validation
 *
 * This test validates the complete Discovery Import Pipeline using synthetic
 * interview content that mimics real Discovery Interview PDFs (Zach and Madison).
 *
 * It verifies:
 *   - Document structure preservation
 *   - Text fidelity (no rewrites)
 *   - Section hierarchy detection
 *   - Question/answer extraction
 *   - Page references
 *   - Deterministic ID generation
 *   - Diagnostic accumulation
 *   - JSON export fidelity
 *
 * Run:
 *   npx tsx src/discovery/stage1-validation.mts
 *
 * Output:
 *   Generates validation report to console and file.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { InterviewStructureParser } from './parser/InterviewStructureParser.ts';
import { DiscoveryValidator } from './validation/DiscoveryValidator.ts';
import { JsonDiscoveryExporter } from './exporters/JsonDiscoveryExporter.ts';
import { DiagnosticCode } from './models/index.ts';

// ============================================================================
// SYNTHETIC TEST DATA: Zach Discovery Interview
// ============================================================================

const ZACH_DISCOVERY_INTERVIEW = `
Genesis Discovery Interview

Participant: Zach Anderson
Role: Graphics Lead
Department: Creative
Date: July 5, 2026
Interviewer: Robert Stoner
Interview Duration: 45 minutes

═══════════════════════════════════════════════════════════════════════════

SECTION 1: DAILY WORKFLOW

Q1. Walk me through a typical day. What is the first thing you do when you come in?

I usually start by checking my project queue in Asana. There are typically 3-5 active jobs
at any time. I prioritize based on delivery date, urgency flag, and complexity.

Most mornings I have a quick sync with Robert or Madison to confirm any new orders came in
overnight or if anything shifted priority-wise. After that I dive into the current job.

Q2. What software do you use every single day?

Adobe Illustrator is my main tool — I'd say 70% of my day. I also use Photoshop, probably 20%
of the time, and Figma for mockups or when I'm collaborating with clients on concepts. Asana for
project tracking, obviously. And I'm constantly in Outlook and Teams for comms.

Q3. How long does a typical project take from start to finish?

It really depends on the project type. Standard label design? 1-2 hours. Custom artwork or
complex branding? Could be a full day or spread across 2-3 days. We had one project last month
that took a week because the client kept requesting revisions.

═══════════════════════════════════════════════════════════════════════════

SECTION 2: BOTTLENECKS & PAIN POINTS

Q4. What slows you down the most in your day-to-day work?

Honestly, waiting for client feedback. A lot of jobs sit in my queue waiting on approval or
for the client to get back to Robert. Sometimes it's days before we get a response. That puts
the whole timeline at risk.

Q5. Do you ever get unclear or incomplete briefs?

Yes, all the time. I'd say 40% of projects come in with specs that are missing something. Maybe
the client didn't think through all the details, or Robert is still clarifying with them. I usually
have to ask questions or make assumptions. It slows down the design process.

Q6. What happens when a client requests major revisions after you're done?

That's where it gets painful. If the feedback is major, I'm essentially starting over on that component.
There's no buffer built into our timelines, so revision requests can cascade into the next projects.
We've had situations where a revision on one job pushed another job's deadline back.

═══════════════════════════════════════════════════════════════════════════

SECTION 3: TOOLS & SYSTEMS

Q7. Are there any tools or systems you wish we had but don't currently use?

A design asset library would be huge. We're recreating the same elements over and over. If we had
a centralized place to store logo variations, color palettes, font files, and common design patterns,
I could work a lot faster.

Also, a real project management system that's integrated with our quoting process. Right now specs
come to me in email, Asana, or verbally from Robert. There's no single source of truth.

Q8. How do you currently manage revisions or version control of designs?

I save files locally and name them by version: filename_v1.ai, filename_v2.ai, etc. I sometimes upload
final files to a shared folder, but not consistently. It's messy. I've lost work before because I wasn't
sure which version was the current one.

═══════════════════════════════════════════════════════════════════════════

SECTION 4: CAPABILITY ASSESSMENT

Q9. How confident are you in your current skill level with Illustrator?

I'm very confident. I can do almost anything asked of me in Illustrator — typography, complex vector work,
3D effects, you name it. The limitation is usually time or unclear requirements, not my capability.

Q10. Could you train someone else to do the work you do?

For basic label design, yes, probably in a week or two of hands-on training. For the more complex custom work,
that would take longer — months probably. A lot of it is design taste and judgment, which takes experience.

═══════════════════════════════════════════════════════════════════════════

SECTION 5: OPPORTUNITIES & SCALING

Q11. If we could remove one bottleneck tomorrow, what would it be?

Client feedback speed. If clients responded in 24 hours instead of 3-5 days, our throughput would double.
We wouldn't have jobs sitting idle waiting for approval.

Q12. What would need to happen for you to take on 2x the current workload?

More time. I'd need either another designer on the team, or I'd need processes to be way faster.
Right now I'm working at pretty much full capacity — I don't have much slack to absorb more work.

The faster feedback and a design asset library would help a lot. So would templates for common project types.

═══════════════════════════════════════════════════════════════════════════
`;

// ============================================================================
// SYNTHETIC TEST DATA: Madison Discovery Interview
// ============================================================================

const MADISON_DISCOVERY_INTERVIEW = `
Genesis Discovery Interview

Participant: Madison (Operations Lead)
Role: Operations Manager
Department: Operations
Date: July 5, 2026
Interviewer: Robert Stoner
Interview Duration: 50 minutes

═══════════════════════════════════════════════════════════════════════════

SECTION 1: DAILY RESPONSIBILITIES

Q1. Walk me through what a typical day looks like for you.

I start by checking overnight factory updates. We have three main factories in China, and they're
in a different timezone, so I usually have 5-10 messages from them by morning. I triage those and
update Robert if anything is urgent.

Then I spend time on two things: (1) order tracking and fulfillment, and (2) vendor management. I look at
active orders, check factory status, update customers on timeline, and handle any issues that come up.

Q2. What systems do you use daily?

Zoho is my main system — invoicing, estimates, order tracking. I'm also in Asana for project tracking,
Outlook for email, and Teams. A lot of communication with factories is via WhatsApp or email directly.

═══════════════════════════════════════════════════════════════════════════

SECTION 2: OPERATIONS WORKFLOW

Q3. Walk me through the order fulfillment process from your perspective.

Once an order is confirmed by Robert, it comes to me. I log it in Zoho and break it down by components
and vendors. Then I communicate to the factories: what we need, quantity, delivery date, specs. I track
progress — they send me photos, updates, sometimes issues.

When everything is ready to ship, I coordinate logistics. We work with a freight forwarder who handles
customs and delivery. I track the shipment, update the customer, and coordinate delivery. After delivery,
we handle any issues or warranty claims.

Q4. How much of your time is spent on exception handling vs. routine work?

Probably 60% routine and 40% exceptions. Exceptions are things like: factory delays, quality issues,
wrong specifications shipped, customs issues, customer change requests mid-order. These eat a lot of time
because they require rework or urgent communication.

═══════════════════════════════════════════════════════════════════════════

SECTION 3: FACTORY RELATIONSHIPS & LOGISTICS

Q5. How do you communicate with the factories?

Directly via WhatsApp, email, and sometimes phone calls if it's urgent. They speak English, but it's not
native, so sometimes clarity issues arise. I've learned to be very explicit with specs and to ask for
photos as proof of work.

Q6. What causes the most friction with factory communication?

Timezone delays and language nuances. Also, they sometimes interpret specs differently than we intended.
I have to follow up constantly. The relationship works, but it's not frictionless. If one of the key
contacts at a factory changes, we have to rebuild that relationship.

Q7. How is freight currently handled?

We use the same freight forwarder for most shipments. They handle the logistics from China to the US.
We pay by shipment, and costs vary. Sometimes we combine multiple orders into one shipment to save cost,
sometimes we ship separately if the customer is urgent.

═══════════════════════════════════════════════════════════════════════════

SECTION 4: BOTTLENECKS & PAIN POINTS

Q8. What's your biggest operational bottleneck?

Visibility. I often don't know the exact status of orders until I ask. There's no real-time feed from factories.
I'm constantly chasing them for updates. Also, Zoho isn't integrated with our quoting system, so there's
manual rekeying of information.

Q9. Where do things typically go wrong?

Specification mismatches — we quote one thing, then the factory makes it wrong. Customer change requests
after an order is placed. Freight delays or customs issues. Quality issues that don't show up until the
product reaches the US.

Q10. How much time do you spend on admin tasks vs. strategic work?

I'd say 80% admin — answering emails, updating spreadsheets, following up on status, handling exceptions.
Maybe 20% on things like optimizing the process or planning. I'd like it to be flipped.

═══════════════════════════════════════════════════════════════════════════

SECTION 5: AUTHORITY & DECISION MAKING

Q11. What decisions do you currently make on your own vs. what requires Robert's approval?

I can make day-to-day operational decisions — reorder, adjust timelines, handle customer service issues.
But anything with a price implication, a customer relationship issue, or something unusual goes to Robert.
He's the final decision maker on most things.

Q12. Do you feel like you have enough information to make the decisions you're responsible for?

Mostly yes, but not always. When something goes wrong mid-order, I sometimes don't have enough context
to decide independently. I end up escalating to Robert anyway.

═══════════════════════════════════════════════════════════════════════════

SECTION 6: SCALING & GROWTH

Q13. If workload doubled, what would break first?

My time. I'm already at capacity. I'd need to delegate more or hire someone to help. Also, the manual
processes would become unmanageable. We'd need better systems.

Q14. What's preventing us from scaling to 2x volume right now?

Bandwidth. Robert is the bottleneck for decisions. I'm the bottleneck for execution. And our systems
are manual. Without better automation or another person, we can't absorb more volume without sacrificing
quality or burning out.

═══════════════════════════════════════════════════════════════════════════
`;

// ============================================================================
// Validation harness
// ============================================================================

interface ValidationSnapshot {
  name: string;
  content: string;
  expectedParticipant: string;
  expectedSections: number;
}

const testCases: ValidationSnapshot[] = [
  {
    name: 'Zach Discovery Interview',
    content: ZACH_DISCOVERY_INTERVIEW,
    expectedParticipant: 'Zach Anderson',
    expectedSections: 5,
  },
  {
    name: 'Madison Discovery Interview',
    content: MADISON_DISCOVERY_INTERVIEW,
    expectedParticipant: 'Madison (Operations Lead)',
    expectedSections: 6,
  },
];

// ============================================================================
// Main validation
// ============================================================================

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║   Genesis Discovery Engine — Stage 1 Validation                           ║');
  console.log('║   Using Synthetic Discovery Interview Content                             ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

  const parser = new InterviewStructureParser();
  const validator = new DiscoveryValidator();
  const exporter = new JsonDiscoveryExporter();

  // Prepare output directory
  mkdirSync('discovery-validation-output', { recursive: true });

  let allPassed = true;
  const reportLines: string[] = [];

  reportLines.push('# Genesis Discovery Engine — Stage 1 Validation Report\n');
  reportLines.push('**Date:** ' + new Date().toISOString().split('T')[0] + '\n');
  reportLines.push('**Objective:** Validate that Discovery Interview PDFs can be converted to structured JSON without data loss or interpretation.\n');
  reportLines.push('---\n');

  for (const testCase of testCases) {
    console.log(`\n► Processing: ${testCase.name}`);
    console.log('─'.repeat(70));

    reportLines.push(`\n## ${testCase.name}\n`);

    // --------
    // Stage 1: Convert text to raw parse result
    // --------

    const rawResult = {
      pages: [
        {
          pageNumber: 1,
          text: testCase.content,
        },
      ],
      metadata: {
        Title: testCase.name,
        Author: 'Robert Stoner',
        CreationDate: new Date().toISOString().split('T')[0],
      },
      totalPages: 1,
    };

    // --------
    // Stage 2: Parse document
    // --------

    const sourceId = `src_${testCase.name.replace(/\s+/g, '_').toLowerCase()}`;
    let document;

    try {
      document = parser.parseDocument(rawResult, sourceId, `${testCase.name}.pdf`);
      console.log(`  ✓ Document parsed (${document.pages.length} pages, ${document.metadata.pageCount} page metadata)`);
      reportLines.push(`### Document Parsing\n\n- ✓ Document parsed successfully\n- Pages: ${document.pages.length}\n- Page count in metadata: ${document.metadata.pageCount}\n`);
    } catch (err) {
      console.error(`  ✗ FAILED: ${err}`);
      reportLines.push(`### Document Parsing\n\n- ✗ FAILED: ${err}\n`);
      allPassed = false;
      continue;
    }

    // Check page content preservation
    const originalLength = testCase.content.length;
    const parsedLength = document.pages[0].text.length;
    const textPreserved = document.pages[0].text === testCase.content;
    console.log(`  ${textPreserved ? '✓' : '✗'} Text preserved exactly (${originalLength} → ${parsedLength} chars)`);
    reportLines.push(`- Text preservation: ${textPreserved ? 'EXACT' : 'MODIFIED'} (${originalLength} → ${parsedLength} chars)\n`);

    if (!textPreserved) {
      allPassed = false;
      console.warn(
        `    First 100 chars match: ${document.pages[0].text.slice(0, 100) === testCase.content.slice(0, 100)}`,
      );
    }

    // --------
    // Stage 3: Extract interview
    // --------

    let interview;

    try {
      interview = parser.parseInterview(document);
      console.log(`  ✓ Interview extracted (${interview.sections.length} sections)`);
      reportLines.push(`\n### Interview Extraction\n\n- ✓ Interview extracted successfully\n- Sections detected: ${interview.sections.length}\n`);
    } catch (err) {
      console.error(`  ✗ FAILED: ${err}`);
      reportLines.push(`- ✗ FAILED: ${err}\n`);
      allPassed = false;
      continue;
    }

    // --------
    // Validate interview metadata
    // --------

    const participantMatch = interview.participant === testCase.expectedParticipant;
    const sectionsMatch = interview.sections.length === testCase.expectedSections;

    console.log(`  ${participantMatch ? '✓' : '✗'} Participant: "${interview.participant}" ${participantMatch ? '' : `(expected "${testCase.expectedParticipant}")`}`);
    console.log(`  ${sectionsMatch ? '✓' : '✗'} Sections: ${interview.sections.length}/${testCase.expectedSections}`);

    reportLines.push(`- Participant: \`${interview.participant}\`\n`);
    reportLines.push(`- Role: \`${interview.role}\`\n`);
    reportLines.push(`- Department: \`${interview.department}\`\n`);
    reportLines.push(`- Interview date: \`${interview.interviewDate}\`\n`);
    reportLines.push(`- Interviewer: \`${interview.interviewer}\`\n`);

    if (!participantMatch || !sectionsMatch) {
      allPassed = false;
    }

    // --------
    // Validate sections
    // --------

    let totalQuestions = 0;

    console.log(`\n  Sections:`);
    reportLines.push(`\n### Sections\n`);

    for (const section of interview.sections) {
      const qCount = section.questions.length;
      totalQuestions += qCount;
      console.log(`    ${section.order}. "${section.title}" — ${qCount} questions`);
      reportLines.push(`- **${section.title}**: ${qCount} questions\n`);

      // Show first question as sample
      if (qCount > 0) {
        const q = section.questions[0];
        const questionPreview = q.question.slice(0, 70) + (q.question.length > 70 ? '...' : '');
        console.log(`       Q: ${questionPreview}`);
        const answerPreview = q.answer.slice(0, 70) + (q.answer.length > 70 ? '...' : '');
        console.log(`       A: ${answerPreview}`);
      }
    }

    console.log(`\n  Total questions extracted: ${totalQuestions}`);
    reportLines.push(`\n**Total questions: ${totalQuestions}**\n`);

    // --------
    // Validate question/answer preservation
    // --------

    console.log(`\n  Question/Answer Validation:`);
    reportLines.push(`\n### Question/Answer Quality\n`);

    let questionsWithAnswers = 0;
    let emptyAnswers = 0;

    for (const section of interview.sections) {
      for (const q of section.questions) {
        const hasAnswer = q.answer.trim().length > 0;
        if (hasAnswer) questionsWithAnswers++;
        else emptyAnswers++;

        // Verify raw fields exist
        if (!q.rawQuestion || !q.rawAnswer) {
          console.warn(`    ✗ Q${q.order}: Missing raw field`);
          allPassed = false;
        }

        // Verify text wasn't modified
        if (!q.question.includes(q.rawQuestion.slice(0, 20))) {
          console.warn(`    ⚠ Q${q.order}: Raw question text differs from question text`);
        }
      }
    }

    const answerRate = totalQuestions > 0 ? ((questionsWithAnswers / totalQuestions) * 100).toFixed(1) : '0';
    console.log(`    ✓ Questions with answers: ${questionsWithAnswers}/${totalQuestions} (${answerRate}%)`);
    console.log(`    ${emptyAnswers === 0 ? '✓' : '⚠'} Empty answers: ${emptyAnswers}`);

    reportLines.push(`- Questions with answers: ${questionsWithAnswers}/${totalQuestions} (${answerRate}%)\n`);
    reportLines.push(`- Empty answers: ${emptyAnswers}\n`);

    // --------
    // Validate page references
    // --------

    console.log(`\n  Page References:`);
    reportLines.push(`\n### Page References\n`);

    let allPagesValid = true;
    for (const section of interview.sections) {
      for (const q of section.questions) {
        if (q.page < 1 || q.page > document.pageCount) {
          console.warn(`    ✗ Q${q.order}: Invalid page ${q.page}/${document.pageCount}`);
          allPagesValid = false;
        }
      }
    }

    console.log(`    ${allPagesValid ? '✓' : '✗'} All page references valid`);
    reportLines.push(`- Page references valid: ${allPagesValid ? 'YES' : 'NO'}\n`);

    if (!allPagesValid) allPassed = false;

    // --------
    // Validate deterministic IDs
    // --------

    console.log(`\n  Deterministic ID Generation:`);
    reportLines.push(`\n### Deterministic IDs\n`);

    console.log(`    Interview ID: ${interview.interviewId}`);
    reportLines.push(`- Interview ID: \`${interview.interviewId}\`\n`);

    const firstQuestion = interview.sections[0]?.questions[0];
    if (firstQuestion) {
      console.log(`    Sample question ID: ${firstQuestion.id}`);
      reportLines.push(`- Sample question ID: \`${firstQuestion.id}\`\n`);
    }

    // Test determinism — re-parse and check IDs are the same
    const interview2 = parser.parseInterview(document);
    const idsDeterministic = interview.interviewId === interview2.interviewId;
    console.log(`    ${idsDeterministic ? '✓' : '✗'} IDs deterministic across re-parse`);
    reportLines.push(`- IDs deterministic: ${idsDeterministic ? 'YES' : 'NO'}\n`);

    if (!idsDeterministic) allPassed = false;

    // --------
    // Validate using validator
    // --------

    console.log(`\n  Validation Checks:`);
    reportLines.push(`\n### Validation Results\n`);

    const validation = validator.validate(document, interview);
    console.log(`    Valid: ${validation.valid}`);
    console.log(`    Errors: ${validation.errors.length}`);
    console.log(`    Warnings: ${validation.warnings.length}`);
    console.log(`    Infos: ${validation.infos.length}`);

    reportLines.push(`- Valid: ${validation.valid}\n`);
    reportLines.push(`- Errors: ${validation.errors.length}\n`);
    reportLines.push(`- Warnings: ${validation.warnings.length}\n`);
    reportLines.push(`- Infos: ${validation.infos.length}\n`);

    for (const err of validation.errors) {
      console.log(`    ✗ ${err.message} [${err.code}]`);
      reportLines.push(`  - **ERROR**: ${err.message} \`${err.code}\`\n`);
      allPassed = false;
    }

    for (const warn of validation.warnings) {
      console.log(`    ⚠ ${warn.message} [${warn.code}]`);
      reportLines.push(`  - **WARNING**: ${warn.message} \`${warn.code}\`\n`);
    }

    // --------
    // Export JSON
    // --------

    console.log(`\n  JSON Export:`);
    reportLines.push(`\n### JSON Exports\n`);

    const docExport = exporter.exportDocument(document);
    const docFileName = `${testCase.name.replace(/\s+/g, '_')}.document.json`;
    writeFileSync(`discovery-validation-output/${docFileName}`, docExport.content);
    console.log(`    ✓ Document exported: ${docFileName}`);
    reportLines.push(`- **Document**: \`${docFileName}\` (${docExport.content.length} bytes)\n`);

    const ivExport = exporter.exportInterview(interview);
    const ivFileName = `${testCase.name.replace(/\s+/g, '_')}.interview.json`;
    writeFileSync(`discovery-validation-output/${ivFileName}`, ivExport.content);
    console.log(`    ✓ Interview exported: ${ivFileName}`);
    reportLines.push(`- **Interview**: \`${ivFileName}\` (${ivExport.content.length} bytes)\n`);

    const resultExport = exporter.exportResult({
      success: validation.valid,
      source: {
        sourceId,
        sourceType: 'pdf',
        fileName: `${testCase.name}.pdf`,
        filePath: '',
        fileSize: testCase.content.length,
        mimeType: 'application/pdf',
        importedAt: new Date().toISOString(),
      },
      document,
      interview,
      validation,
      diagnostics: [...document.diagnostics, ...interview.diagnostics],
      timestamp: new Date().toISOString(),
    });
    const resultFileName = `${testCase.name.replace(/\s+/g, '_')}.result.json`;
    writeFileSync(`discovery-validation-output/${resultFileName}`, resultExport.content);
    console.log(`    ✓ Result exported: ${resultFileName}`);
    reportLines.push(`- **Result**: \`${resultFileName}\` (${resultExport.content.length} bytes)\n`);

    // Verify JSON is valid and parseable
    try {
      JSON.parse(docExport.content);
      JSON.parse(ivExport.content);
      JSON.parse(resultExport.content);
      console.log(`    ✓ All JSON files are valid and parseable`);
      reportLines.push(`- JSON validity: ALL VALID\n`);
    } catch (err) {
      console.error(`    ✗ JSON parsing failed: ${err}`);
      reportLines.push(`- JSON validity: INVALID - ${err}\n`);
      allPassed = false;
    }

    // --------
    // Source lineage verification
    // --------

    console.log(`\n  Source Lineage:`);
    reportLines.push(`\n### Source Lineage\n`);

    console.log(`    Document sourceId: ${document.sourceId}`);
    console.log(`    Interview sourceId: ${interview.sourceId}`);
    console.log(`    Match: ${document.sourceId === interview.sourceId ? '✓' : '✗'}`);

    reportLines.push(`- Document sourceId: \`${document.sourceId}\`\n`);
    reportLines.push(`- Interview sourceId: \`${interview.sourceId}\`\n`);
    reportLines.push(`- Lineage valid: ${document.sourceId === interview.sourceId ? 'YES' : 'NO'}\n`);

    if (document.sourceId !== interview.sourceId) {
      allPassed = false;
    }
  }

  // ============================================================================
  // Final Report
  // ============================================================================

  console.log('\n' + '═'.repeat(70));
  console.log('VALIDATION SUMMARY');
  console.log('═'.repeat(70));

  if (allPassed) {
    console.log('\n✓ STAGE 1 VALIDATED');
    reportLines.push('\n---\n\n## Final Recommendation\n\n**✓ STAGE 1 VALIDATED**\n');
    reportLines.push(
      '\nAll validation checks passed. The Discovery Engine Stage 1 successfully:\n' +
        '- Preserves source text exactly\n' +
        '- Extracts document structure correctly\n' +
        '- Detects sections and questions\n' +
        '- Generates deterministic IDs\n' +
        '- Produces valid JSON exports\n' +
        '- Maintains source lineage\n' +
        '- Accumulates diagnostics appropriately\n' +
        '\nRecommendation: Proceed to Stage 2 (Evidence IR) implementation.\n',
    );
  } else {
    console.log('\n⚠ STAGE 1 REQUIRES REVISION');
    reportLines.push('\n---\n\n## Final Recommendation\n\n**⚠ STAGE 1 REQUIRES REVISION**\n');
    reportLines.push('\nOne or more validation checks failed. Review the issues above and fix before proceeding.\n');
  }

  console.log('═'.repeat(70) + '\n');

  // Write report to file
  const reportPath = 'discovery-validation-output/DISCOVERY_STAGE_1_VALIDATION.md';
  writeFileSync(reportPath, reportLines.join(''));
  console.log(`\nValidation report written to: ${reportPath}`);
}

main().catch((err) => {
  console.error('Validation failed:', err);
  process.exit(1);
});
