/**
 * KnowledgeGraphTestSuite.mjs
 *
 * Test suite for Genesis Knowledge Graph Compiler
 * Integrates with main TestRunner
 *
 * @module tools/genesis/tests/suites/KnowledgeGraphTestSuite.mjs
 */

import { TestSuite } from "../TestSuite.mjs";
import {
  IndustryBlueprint,
  DomainBlueprint,
  CapabilityBlueprint,
  ProcessBlueprint,
  ConceptBlueprint,
  TerminologyBlueprint,
  RegulationBlueprint,
  RelationshipEdge,
  KnowledgeGraphIndex,
  KnowledgeGraphResult
} from "../../compiler/KnowledgeGraphBlueprint.mjs";
import { KnowledgeCompiler } from "../../compiler/KnowledgeCompiler.mjs";

export default async function KnowledgeGraphTestSuite() {
  const suite = new TestSuite(
    "Knowledge Graph Compiler Tests",
    "Test Genesis Enterprise Knowledge Graph Compiler v1"
  );

  // Blueprint Tests
  suite.addTest("IndustryBlueprint validation", async () => {
    const industry = new IndustryBlueprint({
      name: 'Financial Services',
      code: 'FINANCE',
      type: 'vertical'
    });
    if (industry.status !== 'draft') throw new Error('Status not draft');
    if (industry.name !== 'Financial Services') throw new Error('Name mismatch');
  });

  suite.addTest("DomainBlueprint validation", async () => {
    const domain = new DomainBlueprint({
      name: 'Operations',
      code: 'OPS',
      type: 'functional'
    });
    if (domain.status !== 'draft') throw new Error('Status not draft');
    if (domain.type !== 'functional') throw new Error('Type mismatch');
  });

  suite.addTest("CapabilityBlueprint validation", async () => {
    const capability = new CapabilityBlueprint({
      name: 'Data Management',
      type: 'operational',
      level: 'core'
    });
    if (capability.level !== 'core') throw new Error('Level mismatch');
    if (capability.type !== 'operational') throw new Error('Type mismatch');
  });

  suite.addTest("ProcessBlueprint validation", async () => {
    const process = new ProcessBlueprint({
      name: 'Order Processing',
      type: 'operational',
      criticality: 'high'
    });
    if (process.criticality !== 'high') throw new Error('Criticality mismatch');
    if (process.type !== 'operational') throw new Error('Type mismatch');
  });

  suite.addTest("ConceptBlueprint validation", async () => {
    const concept = new ConceptBlueprint({
      name: 'Customer',
      conceptType: 'entity'
    });
    if (concept.conceptType !== 'entity') throw new Error('ConceptType mismatch');
    if (concept.status !== 'draft') throw new Error('Status not draft');
  });

  suite.addTest("TerminologyBlueprint validation", async () => {
    const term = new TerminologyBlueprint({
      term: 'Customer',
      definition: 'A person or entity'
    });
    if (term.term !== 'Customer') throw new Error('Term mismatch');
    if (term.definition !== 'A person or entity') throw new Error('Definition mismatch');
  });

  suite.addTest("RegulationBlueprint validation", async () => {
    const regulation = new RegulationBlueprint({
      name: 'GDPR',
      code: 'GDPR-2018',
      type: 'privacy'
    });
    if (regulation.name !== 'GDPR') throw new Error('Name mismatch');
    if (regulation.type !== 'privacy') throw new Error('Type mismatch');
  });

  suite.addTest("RelationshipEdge validation", async () => {
    const edge = new RelationshipEdge({
      fromId: 'ind-1',
      toId: 'dom-1',
      relationshipType: 'has-domain'
    });
    if (edge.relationshipType !== 'has-domain') throw new Error('RelationshipType mismatch');
    if (edge.status !== 'defined') throw new Error('Status not defined');
  });

  // Loader Tests
  suite.addTest("Industry loading", async () => {
    const compiler = new KnowledgeCompiler();
    const industries = compiler.loadIndustries();
    if (industries.length === 0) throw new Error('No industries loaded');
    if (!industries.some(i => i.code === 'FINANCE')) throw new Error('FINANCE industry not loaded');
  });

  suite.addTest("Domain loading", async () => {
    const compiler = new KnowledgeCompiler();
    const domains = compiler.loadDomains();
    if (domains.length === 0) throw new Error('No domains loaded');
    if (!domains.some(d => d.code === 'OPS')) throw new Error('OPS domain not loaded');
  });

  suite.addTest("Capability loading", async () => {
    const compiler = new KnowledgeCompiler();
    const capabilities = compiler.loadCapabilities();
    if (capabilities.length === 0) throw new Error('No capabilities loaded');
    if (!capabilities.some(c => c.name === 'Data Management')) throw new Error('Data Management not loaded');
  });

  suite.addTest("Process loading", async () => {
    const compiler = new KnowledgeCompiler();
    const processes = compiler.loadProcesses();
    if (processes.length === 0) throw new Error('No processes loaded');
    if (!processes.some(p => p.name.includes('Order'))) throw new Error('Order processing not loaded');
  });

  suite.addTest("Terminology loading", async () => {
    const compiler = new KnowledgeCompiler();
    const terminology = compiler.loadTerminology();
    if (terminology.length === 0) throw new Error('No terminology loaded');
    for (const term of terminology) {
      if (!term.term || !term.definition) throw new Error('Invalid terminology entry');
    }
  });

  suite.addTest("Regulation loading", async () => {
    const compiler = new KnowledgeCompiler();
    const regulations = compiler.loadRegulations();
    if (regulations.length === 0) throw new Error('No regulations loaded');
    if (!regulations.some(r => r.code === 'GDPR-2018')) throw new Error('GDPR not loaded');
  });

  // Index Tests
  suite.addTest("Knowledge graph index creation", async () => {
    const index = new KnowledgeGraphIndex();
    if (!(index.byId instanceof Map)) throw new Error('byId not a Map');
    if (!(index.byName instanceof Map)) throw new Error('byName not a Map');
    if (!(index.byType instanceof Map)) throw new Error('byType not a Map');
  });

  suite.addTest("Index asset add and retrieve", async () => {
    const index = new KnowledgeGraphIndex();
    const industry = new IndustryBlueprint({ name: 'Test', code: 'TEST' });
    index.add(industry);
    if (index.findById(industry.id) !== industry) throw new Error('Retrieve failed');
  });

  suite.addTest("Index filtering by type", async () => {
    const index = new KnowledgeGraphIndex();
    const industry = new IndustryBlueprint({ name: 'Test', type: 'vertical' });
    index.add(industry);
    const byType = index.findByType('vertical');
    if (byType.length === 0) throw new Error('Filter failed');
  });

  suite.addTest("Index statistics", async () => {
    const index = new KnowledgeGraphIndex();
    const industry = new IndustryBlueprint({ name: 'Test' });
    index.add(industry);
    const stats = index.getStats();
    if (stats.totalAssets !== 1) throw new Error('Stats incorrect');
  });

  // Status Transitions
  suite.addTest("Status lifecycle transitions", async () => {
    const industry = new IndustryBlueprint({ name: 'Test' });
    industry.markDefined();
    industry.markValidated();
    industry.markApproved();
    if (industry.status !== 'approved') throw new Error('Status not approved');
  });

  // Serialization Tests
  suite.addTest("Industry serialization to JSON", async () => {
    const industry = new IndustryBlueprint({ name: 'Test', code: 'TEST' });
    const json = industry.toJSON();
    if (json.name !== 'Test') throw new Error('Name serialization failed');
    if (json.code !== 'TEST') throw new Error('Code serialization failed');
  });

  suite.addTest("Domain serialization to JSON", async () => {
    const domain = new DomainBlueprint({ name: 'Test', code: 'TEST', type: 'functional' });
    const json = domain.toJSON();
    if (json.type !== 'functional') throw new Error('Type serialization failed');
  });

  // Relationship Building
  suite.addTest("Relationship graph building", async () => {
    const compiler = new KnowledgeCompiler();
    const assets = compiler.initializeKnowledgeGraph();
    const relationships = compiler.buildRelationshipGraph(assets);
    if (relationships.length === 0) throw new Error('No relationships built');
  });

  suite.addTest("Relationship serialization", async () => {
    const edge = new RelationshipEdge({
      fromId: 'ind-1',
      toId: 'dom-1',
      relationshipType: 'has-domain'
    });
    const json = edge.toJSON();
    if (json.fromId !== 'ind-1') throw new Error('FromId serialization failed');
    if (json.relationshipType !== 'has-domain') throw new Error('RelationshipType serialization failed');
  });

  // Compilation Tests
  suite.addTest("Full knowledge graph compilation", async () => {
    const compiler = new KnowledgeCompiler();
    const result = await compiler.compileKnowledgeGraph({ persist: false });
    if (result.status !== 'success') throw new Error('Compilation failed');
  });

  suite.addTest("Compilation has all components", async () => {
    const compiler = new KnowledgeCompiler();
    const result = await compiler.compileKnowledgeGraph({ persist: false });
    if (result.industries.length === 0) throw new Error('No industries');
    if (result.domains.length === 0) throw new Error('No domains');
    if (result.capabilities.length === 0) throw new Error('No capabilities');
    if (result.processes.length === 0) throw new Error('No processes');
  });

  suite.addTest("Compilation metrics tracked", async () => {
    const compiler = new KnowledgeCompiler();
    const result = await compiler.compileKnowledgeGraph({ persist: false });
    if (result.metrics.industriesLoaded === 0) throw new Error('No industries loaded metric');
    if (result.metrics.domainsLoaded === 0) throw new Error('No domains loaded metric');
    if (result.metrics.capabilitiesLoaded === 0) throw new Error('No capabilities loaded metric');
  });

  suite.addTest("Compilation result serialization", async () => {
    const compiler = new KnowledgeCompiler();
    const result = await compiler.compileKnowledgeGraph({ persist: false });
    const json = result.toJSON();
    if (json.status !== 'success') throw new Error('Status not success');
    if (json.industriesCount === 0) throw new Error('No industries count');
  });

  suite.addTest("Compiler provides summary", async () => {
    const compiler = new KnowledgeCompiler();
    await compiler.compileKnowledgeGraph({ persist: false });
    const summary = compiler.getSummary();
    if (summary.status !== 'success') throw new Error('Summary status not success');
    if (summary.totalAssets === 0) throw new Error('No total assets');
  });

  // Validation Tests
  suite.addTest("Asset validation", async () => {
    const compiler = new KnowledgeCompiler();
    const assets = compiler.initializeKnowledgeGraph();
    const validation = compiler.validateAssets(assets);
    if (!Array.isArray(validation.errors)) throw new Error('Errors not array');
    if (!Array.isArray(validation.warnings)) throw new Error('Warnings not array');
  });

  suite.addTest("Invalid blueprint throws error", async () => {
    try {
      new IndustryBlueprint({ name: '', type: 'invalid' });
      throw new Error('Should have thrown');
    } catch (e) {
      if (!e.message.includes('Invalid') && !e.message.includes('type')) throw e;
    }
  });

  suite.addTest("Valid blueprints pass validation", async () => {
    const industry = new IndustryBlueprint({ name: 'Test', type: 'vertical' });
    try {
      industry.validate();
    } catch (error) {
      throw new Error('Validation should not throw: ' + error.message);
    }
  });

  // Reference Resolution
  suite.addTest("Reference resolution in graph", async () => {
    const compiler = new KnowledgeCompiler();
    const assets = compiler.initializeKnowledgeGraph();
    const relationships = compiler.buildRelationshipGraph(assets);
    const unresolvedRefs = compiler.resolveReferences(assets, relationships);
    if (!Array.isArray(unresolvedRefs)) throw new Error('Unresolved refs not array');
  });

  return suite;
}
