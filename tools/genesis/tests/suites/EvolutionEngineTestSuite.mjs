/**
 * EvolutionEngineTestSuite.mjs
 *
 * Test suite for Genesis Evolution Engine v1
 * Integrates with main TestRunner
 *
 * @module tools/genesis/tests/suites/EvolutionEngineTestSuite.mjs
 */

import { TestSuite } from "../TestSuite.mjs";
import {
  EvolutionObservation,
  EvolutionCandidate,
  EvolutionImpact,
  EvolutionConfidence,
  EvolutionProposal,
  EvolutionRecommendation,
  EvolutionResult
} from "../../compiler/EvolutionBlueprint.mjs";
import { EvolutionEngine } from "../../compiler/EvolutionEngine.mjs";

export default async function EvolutionEngineTestSuite() {
  const suite = new TestSuite(
    "Evolution Engine Tests",
    "Test Genesis Enterprise Evolution Engine v1"
  );

  // ===== Blueprint Contract Tests =====

  suite.addTest("EvolutionObservation contract validation", async () => {
    const obs = new EvolutionObservation({
      domain: 'workflow_redesign',
      aspect: 'workflow efficiency',
      severity: 0.8,
      confidence: 0.9
    });
    if (obs.status !== 'draft') throw new Error('Status not draft');
    if (!obs.id.startsWith('obs-')) throw new Error('ID not prefixed');
  });

  suite.addTest("EvolutionCandidate contract validation", async () => {
    const cand = new EvolutionCandidate({
      type: 'workflow_redesign',
      name: 'Test Candidate'
    });
    if (cand.status !== 'draft') throw new Error('Status not draft');
    if (!cand.id.startsWith('cand-')) throw new Error('ID not prefixed');
  });

  suite.addTest("EvolutionImpact contract validation", async () => {
    const impact = new EvolutionImpact({
      category: 'efficiency',
      value: 1.25
    });
    if (impact.status !== 'draft') throw new Error('Status not draft');
    if (impact.value !== 1.25) throw new Error('Value not set');
  });

  suite.addTest("EvolutionConfidence contract validation", async () => {
    const conf = new EvolutionConfidence({
      score: 0.85
    });
    if (conf.score !== 0.85) throw new Error('Score not set');
    if (conf.score < 0 || conf.score > 1) throw new Error('Score out of bounds');
  });

  suite.addTest("EvolutionProposal contract validation", async () => {
    const impacts = [new EvolutionImpact({ category: 'efficiency', value: 1.2 })];
    const conf = new EvolutionConfidence({ score: 0.8 });
    const prop = new EvolutionProposal({
      candidate: 'cand-123',
      impacts,
      confidence: conf
    });
    if (prop.status !== 'draft') throw new Error('Status not draft');
    if (!prop.id.startsWith('prop-')) throw new Error('ID not prefixed');
  });

  suite.addTest("EvolutionRecommendation contract validation", async () => {
    const impacts = [new EvolutionImpact({ category: 'efficiency', value: 1.2 })];
    const conf = new EvolutionConfidence({ score: 0.8 });
    const prop = new EvolutionProposal({
      candidate: 'cand-123',
      impacts,
      confidence: conf
    });
    const rec = new EvolutionRecommendation({
      proposals: [prop]
    });
    if (rec.status !== 'draft') throw new Error('Status not draft');
    if (!rec.id.startsWith('rec-')) throw new Error('ID not prefixed');
  });

  suite.addTest("EvolutionResult contract validation", async () => {
    const result = new EvolutionResult();
    if (result.status !== 'draft') throw new Error('Status not draft');
    if (!result.id.startsWith('result-')) throw new Error('ID not prefixed');
  });

  // ===== Status Lifecycle Tests =====

  suite.addTest("EvolutionObservation status transitions", async () => {
    const obs = new EvolutionObservation({
      domain: 'workflow_redesign',
      aspect: 'test',
      severity: 0.5
    });
    if (obs.status !== 'draft') throw new Error('Initial status wrong');
    obs.markDefined();
    if (obs.status !== 'defined') throw new Error('Defined status wrong');
    obs.markValidated();
    if (obs.status !== 'validated') throw new Error('Validated status wrong');
  });

  suite.addTest("EvolutionCandidate status transitions", async () => {
    const cand = new EvolutionCandidate({
      type: 'workflow_redesign',
      name: 'Test'
    });
    cand.markDefined();
    if (cand.status !== 'defined') throw new Error('Defined status wrong');
  });

  suite.addTest("EvolutionProposal status transitions", async () => {
    const impacts = [new EvolutionImpact({ category: 'efficiency', value: 1.2 })];
    const prop = new EvolutionProposal({
      candidate: 'cand-123',
      impacts
    });
    prop.markProposed();
    if (prop.status !== 'proposed') throw new Error('Proposed status wrong');
    prop.markApproved();
    if (prop.status !== 'approved') throw new Error('Approved status wrong');
  });

  // ===== Serialization Tests =====

  suite.addTest("EvolutionObservation serialization", async () => {
    const obs = new EvolutionObservation({
      domain: 'workflow_redesign',
      aspect: 'test',
      severity: 0.7
    });
    const json = obs.toJSON();
    if (!json.id) throw new Error('ID missing in JSON');
    if (json.domain !== 'workflow_redesign') throw new Error('Domain not serialized');
  });

  suite.addTest("EvolutionCandidate serialization", async () => {
    const cand = new EvolutionCandidate({
      type: 'module_boundaries',
      name: 'Test Candidate'
    });
    const json = cand.toJSON();
    if (json.type !== 'module_boundaries') throw new Error('Type not serialized');
    if (json.name !== 'Test Candidate') throw new Error('Name not serialized');
  });

  suite.addTest("EvolutionProposal serialization", async () => {
    const impacts = [new EvolutionImpact({ category: 'efficiency', value: 1.2 })];
    const prop = new EvolutionProposal({
      candidate: 'cand-123',
      impacts,
      title: 'Test Proposal'
    });
    const json = prop.toJSON();
    if (json.title !== 'Test Proposal') throw new Error('Title not serialized');
    if (!Array.isArray(json.impacts)) throw new Error('Impacts not array');
  });

  // ===== Evolution Engine Tests =====

  suite.addTest("Evolution Engine initializes", async () => {
    const engine = new EvolutionEngine();
    if (!engine.evolutionDomains || engine.evolutionDomains.length === 0) {
      throw new Error('No evolution domains');
    }
    if (engine.evolutionDomains.length !== 9) throw new Error('Wrong domain count');
  });

  suite.addTest("Engine captures observations", async () => {
    const engine = new EvolutionEngine();
    const obs = engine.captureObservations();
    if (obs.length === 0) throw new Error('No observations captured');
    if (!obs[0].id.startsWith('obs-')) throw new Error('Invalid observation ID');
  });

  suite.addTest("Engine identifies candidates", async () => {
    const engine = new EvolutionEngine();
    engine.captureObservations();
    const candidates = engine.identifyCandidates();
    if (!Array.isArray(candidates)) throw new Error('Candidates not array');
    if (candidates.length > 0 && !candidates[0].type) throw new Error('Candidate missing type');
  });

  suite.addTest("Engine assesses impacts", async () => {
    const engine = new EvolutionEngine();
    const impacts = engine.assessImpacts();
    if (!Array.isArray(impacts)) throw new Error('Impacts not array');
    if (impacts.length > 0 && impacts[0].value < 1) throw new Error('Impact value invalid');
  });

  suite.addTest("Engine generates proposals", async () => {
    const engine = new EvolutionEngine();
    engine.captureObservations();
    engine.identifyCandidates();
    const proposals = engine.generateProposals();
    if (!Array.isArray(proposals)) throw new Error('Proposals not array');
    if (proposals.length > 0 && !proposals[0].confidence) throw new Error('Proposal missing confidence');
  });

  suite.addTest("Engine creates recommendation", async () => {
    const engine = new EvolutionEngine();
    engine.captureObservations();
    engine.identifyCandidates();
    engine.generateProposals();
    const rec = engine.createRecommendation();
    if (!rec) throw new Error('No recommendation created');
    if (rec.proposals.length === 0) throw new Error('Recommendation empty');
  });

  suite.addTest("Full evolution pipeline executes", async () => {
    const engine = new EvolutionEngine();
    const result = await engine.analyzeEvolution({ persist: false });
    if (result.status !== 'success') throw new Error('Pipeline failed');
    if (!result.id) throw new Error('Result missing ID');
  });

  suite.addTest("Pipeline produces all components", async () => {
    const engine = new EvolutionEngine();
    const result = await engine.analyzeEvolution({ persist: false });

    if (result.observations.length === 0) throw new Error('No observations');
    if (result.candidates.length === 0) throw new Error('No candidates');
    if (result.proposals.length === 0) throw new Error('No proposals');
    if (!result.recommendation) throw new Error('No recommendation');
  });

  suite.addTest("Pipeline generates summary", async () => {
    const engine = new EvolutionEngine();
    await engine.analyzeEvolution({ persist: false });
    const summary = engine.getSummary();

    if (!summary.id) throw new Error('Summary missing ID');
    if (summary.status !== 'success') throw new Error('Summary status wrong');
    if (!summary.metrics) throw new Error('Summary missing metrics');
  });

  // ===== Domain Tests =====

  suite.addTest("All evolution domains supported", async () => {
    const engine = new EvolutionEngine();
    const expectedDomains = [
      'workflow_redesign',
      'module_boundaries',
      'application_composition',
      'organizational_structure',
      'approval_chains',
      'automation_opportunities',
      'reporting_structure',
      'ai_delegation',
      'process_simplification'
    ];

    for (const domain of expectedDomains) {
      if (!engine.evolutionDomains.includes(domain)) {
        throw new Error(`Domain ${domain} not supported`);
      }
    }
  });

  suite.addTest("Observations span all domains", async () => {
    const engine = new EvolutionEngine();
    engine.captureObservations();
    const domains = new Set(engine.observations.map(o => o.domain));

    if (domains.size === 0) throw new Error('No domains in observations');
    if (domains.size < 5) throw new Error('Too few domains');
  });

  suite.addTest("Candidates assigned to appropriate domains", async () => {
    const engine = new EvolutionEngine();
    engine.captureObservations();
    engine.identifyCandidates();

    for (const cand of engine.candidates) {
      if (!engine.evolutionDomains.includes(cand.type)) {
        throw new Error(`Invalid candidate domain: ${cand.type}`);
      }
    }
  });

  // ===== Ranking Tests =====

  suite.addTest("Proposals ranked by priority and ROI", async () => {
    const engine = new EvolutionEngine();
    await engine.analyzeEvolution({ persist: false });

    if (engine.proposals.length < 2) return; // Need at least 2 to test ordering

    for (let i = 0; i < engine.proposals.length - 1; i++) {
      const current = engine.proposals[i];
      const next = engine.proposals[i + 1];

      const priorityMap = { critical: 4, high: 3, medium: 2, low: 1 };
      const currentScore = (priorityMap[current.priority] || 0) * 100 + (current.estimatedROI || 0);
      const nextScore = (priorityMap[next.priority] || 0) * 100 + (next.estimatedROI || 0);

      if (currentScore < nextScore) {
        throw new Error('Proposals not properly ranked');
      }
    }
  });

  suite.addTest("Recommendation prioritizes high-impact proposals", async () => {
    const engine = new EvolutionEngine();
    const result = await engine.analyzeEvolution({ persist: false });

    if (result.recommendation && result.recommendation.proposals.length > 1) {
      const first = result.recommendation.proposals[0];
      const second = result.recommendation.proposals[1];

      const getScore = (p) => {
        const priorityMap = { critical: 4, high: 3, medium: 2, low: 1 };
        return (priorityMap[p.priority] || 0) * 100 + (p.estimatedROI || 0);
      };

      if (getScore(first) < getScore(second)) {
        throw new Error('First proposal not highest priority');
      }
    }
  });

  // ===== Impact Assessment Tests =====

  suite.addTest("Impact covers all categories", async () => {
    const engine = new EvolutionEngine();
    const impacts = engine.assessImpacts();

    const categories = new Set(impacts.map(i => i.category));
    if (categories.size === 0) throw new Error('No impact categories');
  });

  suite.addTest("Impact values are positive improvements", async () => {
    const engine = new EvolutionEngine();
    const impacts = engine.assessImpacts();

    for (const impact of impacts) {
      if (impact.value < 1) throw new Error('Impact value less than 1 (no improvement)');
      if (impact.value > 2) throw new Error('Impact value unrealistic (>100% improvement)');
    }
  });

  suite.addTest("Confidence scores are valid", async () => {
    const engine = new EvolutionEngine();
    const result = await engine.analyzeEvolution({ persist: false });

    for (const prop of result.proposals) {
      if (prop.confidence) {
        const score = prop.confidence.score;
        if (score < 0 || score > 1) throw new Error('Invalid confidence score');
      }
    }
  });

  // ===== Validation Tests =====

  suite.addTest("Invalid observation throws error", async () => {
    try {
      new EvolutionObservation({ aspect: 'test' }); // missing domain
      throw new Error('Should have thrown');
    } catch (e) {
      if (e.message === 'Should have thrown') throw e;
      if (!e.message.includes('required')) throw e;
    }
  });

  suite.addTest("Invalid candidate throws error", async () => {
    try {
      new EvolutionCandidate({ type: 'test' }); // missing name
      throw new Error('Should have thrown');
    } catch (e) {
      if (e.message === 'Should have thrown') throw e;
      if (!e.message.includes('required')) throw e;
    }
  });

  suite.addTest("Invalid proposal throws error", async () => {
    try {
      new EvolutionProposal({ candidate: 'test' }); // missing impacts
      throw new Error('Should have thrown');
    } catch (e) {
      if (e.message === 'Should have thrown') throw e;
      if (!e.message.includes('required')) throw e;
    }
  });

  suite.addTest("Invalid recommendation throws error", async () => {
    try {
      new EvolutionRecommendation({}); // missing proposals
      throw new Error('Should have thrown');
    } catch (e) {
      if (e.message === 'Should have thrown') throw e;
      if (!e.message.includes('required')) throw e;
    }
  });

  // ===== Integration Tests =====

  suite.addTest("Evolution result serializes correctly", async () => {
    const engine = new EvolutionEngine();
    const result = await engine.analyzeEvolution({ persist: false });
    const json = result.toJSON();

    if (!json.observations) throw new Error('Observations not serialized');
    if (!json.candidates) throw new Error('Candidates not serialized');
    if (!json.proposals) throw new Error('Proposals not serialized');
    if (!json.recommendation) throw new Error('Recommendation not serialized');
    if (!json.metrics) throw new Error('Metrics not serialized');
  });

  suite.addTest("Engine metrics tracking accurate", async () => {
    const engine = new EvolutionEngine();
    const result = await engine.analyzeEvolution({ persist: false });

    if (result.metrics.observationsCaptured !== engine.observations.length) {
      throw new Error('Observation count mismatch');
    }
    if (result.metrics.candidatesIdentified !== engine.candidates.length) {
      throw new Error('Candidate count mismatch');
    }
    if (result.metrics.proposalsGenerated !== engine.proposals.length) {
      throw new Error('Proposal count mismatch');
    }
  });

  suite.addTest("Affected entities identified for candidates", async () => {
    const engine = new EvolutionEngine();
    engine.captureObservations();
    engine.identifyCandidates();

    for (const cand of engine.candidates) {
      if (!cand.affectedEntities || cand.affectedEntities.length === 0) {
        throw new Error('Candidate missing affected entities');
      }
    }
  });

  suite.addTest("Prerequisites defined for implementation", async () => {
    const engine = new EvolutionEngine();
    engine.captureObservations();
    engine.identifyCandidates();

    for (const cand of engine.candidates) {
      if (!cand.prerequisites || cand.prerequisites.length === 0) {
        throw new Error('Candidate missing prerequisites');
      }
    }
  });

  suite.addTest("Risks identified for candidates", async () => {
    const engine = new EvolutionEngine();
    engine.captureObservations();
    engine.identifyCandidates();

    for (const cand of engine.candidates) {
      if (!cand.risks || cand.risks.length === 0) {
        throw new Error('Candidate missing risks');
      }
    }
  });

  suite.addTest("Dependencies mapped for candidates", async () => {
    const engine = new EvolutionEngine();
    engine.captureObservations();
    engine.identifyCandidates();

    for (const cand of engine.candidates) {
      if (!cand.dependencies) {
        throw new Error('Candidate missing dependencies');
      }
    }
  });

  return suite;
}
