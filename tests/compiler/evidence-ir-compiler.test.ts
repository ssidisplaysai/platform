import assert from "node:assert/strict";
import test from "node:test";

import { compileEvidenceIR } from "../../src/evidence-ir/compiler";
import type { DiscoveryInterview } from "../../src/discovery/models";

function createInterview(
  interviewId: string,
  participant: string,
  answer: string,
  questionId: string = "q-1",
): DiscoveryInterview {
  return {
    interviewId,
    participant,
    role: "Engineer",
    department: "Platform",
    interviewDate: "2026-07-15T00:00:00.000Z",
    interviewer: "Copilot",
    sourceId: `source-${interviewId}`,
    sections: [
      {
        title: "Core",
        order: 1,
        startPage: 1,
        questions: [
          {
            id: questionId,
            question: "What is the answer?",
            answer,
            rawQuestion: "What is the answer?",
            rawAnswer: answer,
            page: 1,
            order: 1,
            answerPages: [1],
          },
        ],
      },
    ],
    rawMetadata: {},
    diagnostics: [],
  };
}

test("evidence IR compiler is deterministic across input order", () => {
  const first = createInterview("interview-b", "Beta", "Platform is deterministic.");
  const second = createInterview("interview-a", "Alpha", "Platform is deterministic.");

  const resultA = compileEvidenceIR([first, second], "2.0.0");
  const resultB = compileEvidenceIR([second, first], "2.0.0");

  assert.equal(resultA.success, true);
  assert.equal(resultB.success, true);
  assert.equal(resultA.inputSource.sourceId, "interview-a,interview-b");
  assert.equal(resultB.inputSource.sourceId, "interview-a,interview-b");
  assert.equal(resultA.evidenceSet?.metadata.identity, resultB.evidenceSet?.metadata.identity);
  assert.deepEqual(
    resultA.evidenceSet?.allItems.map((item) => item.metadata.identity),
    resultB.evidenceSet?.allItems.map((item) => item.metadata.identity),
  );
});

test("evidence IR compiler deduplicates identical items across interviews", () => {
  const first = createInterview("interview-a", "Alpha", "Shared evidence.");
  const second = createInterview("interview-b", "Beta", "Shared evidence.");

  const result = compileEvidenceIR([first, second], "2.0.0");

  assert.equal(result.success, true);
  assert.equal(result.evidenceSet?.collections.length, 2);
  assert.equal(result.evidenceSet?.packages.length, 1);
  assert.equal(result.evidenceSet?.packages[0].deduplicationResults.totalInputItems, 2);
  assert.equal(result.evidenceSet?.packages[0].deduplicationResults.totalDeduplicatedItems, 1);
  assert.equal(result.evidenceSet?.crossReferences.duplicatesRemoved, 1);
  assert.equal(result.evidenceSet?.allItems.length, 1);
});

test("evidence IR compiler fails validation for empty canonical content", () => {
  const invalidInterview = createInterview("interview-invalid", "Gamma", "   ");

  const result = compileEvidenceIR([invalidInterview], "2.0.0");

  assert.equal(result.success, false);
  assert.equal(result.evidenceSet?.collections[0].items[0].validationResults.isValid, false);
  assert.ok((result.evidenceSet?.collections[0].items[0].validationResults.violations ?? []).some((violation) => violation.code === "EIR_043"));
});