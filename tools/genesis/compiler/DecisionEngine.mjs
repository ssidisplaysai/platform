/**
 * Decision Engine - Metadata-Driven Enterprise Decision Evaluation
 * 
 * Executes decision analysis with a 8-stage pipeline:
 * 1. Initialize Decision Blueprint
 * 2. Load Decision Context
 * 3. Load Evaluation Options
 * 4. Evaluate Options Against Criteria
 * 5. Check Constraints
 * 6. Rank Alternatives
 * 7. Generate Explanation
 * 8. Create Recommendation
 * 
 * All evaluation is deterministic based on metadata and inputs.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  EnterpriseDecision,
  DecisionContext,
  DecisionCriteria,
  DecisionConstraint,
  DecisionOption,
  DecisionScore,
  DecisionExplanation,
  DecisionRecommendation
} from './DecisionBlueprint.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * DecisionEngine - Main decision evaluation engine
 */
export class DecisionEngine {
  constructor(options = {}) {
    this.options = options;
    this.decision = null;
    this.context = null;
    this.options_list = [];
    this.scores = [];
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Execute complete decision evaluation process
   */
  async executeDecision(decisionData = {}) {
    try {
      // Stage 1: Initialize Blueprint
      this.initializeBlueprint(decisionData);

      // Stage 2: Load Decision Context
      this.loadContext(decisionData.context || {});

      // Stage 3: Load Evaluation Options
      this.loadOptions(decisionData.options || []);

      // Stage 4: Evaluate Options Against Criteria
      this.evaluateOptions();

      // Stage 5: Check Constraints
      this.checkConstraints();

      // Stage 6: Rank Alternatives
      this.rankAlternatives();

      // Stage 7: Generate Explanation
      this.generateExplanation();

      // Stage 8: Create Recommendation
      this.createRecommendation();

      // Persist artifacts
      await this.persistArtifacts();

      return {
        success: true,
        decisionId: this.decision.id,
        selectedOptionId: this.decision.selectedOption?.id,
        errors: this.errors,
        warnings: this.warnings
      };
    } catch (error) {
      this.errors.push(`Decision execution failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stage 1: Initialize Blueprint
   */
  initializeBlueprint(decisionData) {
    this.decision = new EnterpriseDecision({
      name: decisionData.name || 'Enterprise Decision',
      description: decisionData.description || '',
      businessObjective: decisionData.businessObjective || '',
      createdBy: decisionData.createdBy || 'system'
    });

    this.decision.markValidated();
  }

  /**
   * Stage 2: Load Decision Context
   */
  loadContext(contextData) {
    // Create default criteria if not provided
    const defaultCriteria = [
      new DecisionCriteria({
        name: 'Cost',
        type: 'cost',
        weight: 0.20,
        direction: 'lower',
        unit: 'USD'
      }),
      new DecisionCriteria({
        name: 'Revenue Impact',
        type: 'revenue',
        weight: 0.20,
        direction: 'higher',
        unit: '%'
      }),
      new DecisionCriteria({
        name: 'Profitability',
        type: 'profitability',
        weight: 0.15,
        direction: 'higher',
        unit: '%'
      }),
      new DecisionCriteria({
        name: 'Schedule',
        type: 'schedule',
        weight: 0.10,
        direction: 'lower',
        unit: 'days'
      }),
      new DecisionCriteria({
        name: 'Resource Utilization',
        type: 'resource',
        weight: 0.10,
        direction: 'higher',
        unit: '%'
      }),
      new DecisionCriteria({
        name: 'Customer Impact',
        type: 'customer',
        weight: 0.10,
        direction: 'higher',
        unit: 'score'
      }),
      new DecisionCriteria({
        name: 'Operational Risk',
        type: 'operational',
        weight: 0.10,
        direction: 'lower',
        unit: 'risk'
      }),
      new DecisionCriteria({
        name: 'Strategic Alignment',
        type: 'strategic',
        weight: 0.10,
        direction: 'higher',
        unit: 'score'
      }),
      new DecisionCriteria({
        name: 'Compliance Score',
        type: 'compliance',
        weight: 0.05,
        direction: 'higher',
        unit: '%'
      })
    ];

    const criteria = contextData.criteria && contextData.criteria.length > 0 
      ? contextData.criteria 
      : defaultCriteria;

    // Create default constraints if not provided
    const defaultConstraints = [
      new DecisionConstraint({
        name: 'Budget Constraint',
        type: 'hard',
        criteria: 'cost',
        operator: '<=',
        threshold: 500000,
        description: 'Total cost must not exceed $500,000'
      }),
      new DecisionConstraint({
        name: 'Timeline Constraint',
        type: 'hard',
        criteria: 'schedule',
        operator: '<=',
        threshold: 180,
        description: 'Implementation must complete within 180 days'
      }),
      new DecisionConstraint({
        name: 'Compliance Requirement',
        type: 'hard',
        criteria: 'compliance',
        operator: '>=',
        threshold: 80,
        description: 'Compliance score must be at least 80%'
      })
    ];

    const constraints = contextData.constraints && contextData.constraints.length > 0 
      ? contextData.constraints 
      : defaultConstraints;

    this.context = new DecisionContext({
      tenantId: contextData.tenantId || 'default',
      organizationId: contextData.organizationId || '',
      decisionType: contextData.decisionType || 'enterprise',
      businessObjective: contextData.businessObjective || 'Select optimal implementation strategy',
      decisionHorizon: contextData.decisionHorizon || 90,
      executionMode: contextData.executionMode || 'analysis',
      criteria: criteria,
      constraints: constraints,
      policies: contextData.policies || []
    });

    this.context.markActive();
    this.decision.context = this.context;
  }

  /**
   * Stage 3: Load Evaluation Options
   */
  loadOptions(optionsData) {
    // Create default options if not provided
    if (!optionsData || optionsData.length === 0) {
      optionsData = this.generateDefaultOptions();
    }

    for (const optionData of optionsData) {
      const option = new DecisionOption(optionData);
      this.options_list.push(option);
      this.decision.options.push(option);
    }
  }

  /**
   * Generate default options for evaluation
   */
  generateDefaultOptions() {
    return [
      {
        name: 'Conservative Implementation',
        description: 'Phased rollout with low risk',
        cost: 250000,
        revenue: 15,
        profitability: 25,
        schedule: 180,
        resourceUtilization: 60,
        customerImpact: 70,
        operationalRisk: 30,
        strategicAlignment: 75,
        complianceScore: 90,
        risks: ['Slower time to benefit', 'Competitive exposure'],
        assumptions: ['Team capacity available', 'Vendor support consistent']
      },
      {
        name: 'Balanced Approach',
        description: 'Mixed phased and parallel implementation',
        cost: 350000,
        revenue: 35,
        profitability: 40,
        schedule: 120,
        resourceUtilization: 75,
        customerImpact: 80,
        operationalRisk: 50,
        strategicAlignment: 85,
        complianceScore: 85,
        risks: ['Medium resource demand', 'Moderate coordination complexity'],
        assumptions: ['Sufficient team members available', 'Vendor responsiveness']
      },
      {
        name: 'Aggressive Transformation',
        description: 'Rapid enterprise-wide transformation',
        cost: 450000,
        revenue: 60,
        profitability: 55,
        schedule: 90,
        resourceUtilization: 90,
        customerImpact: 90,
        operationalRisk: 75,
        strategicAlignment: 95,
        complianceScore: 80,
        risks: ['High resource demands', 'Complex coordination', 'Execution risk'],
        assumptions: ['Full team mobilization', 'Executive commitment', 'No competing priorities']
      }
    ];
  }

  /**
   * Stage 4: Evaluate Options Against Criteria
   */
  evaluateOptions() {
    for (const option of this.options_list) {
      const score = new DecisionScore({ optionId: option.id });
      let totalWeightedScore = 0;
      let totalWeight = 0;
      const typeScores = {};

      for (const criteria of this.context.criteria) {
        // Get the option's value for this criteria
        const metricValue = option.getMetricValue(criteria.type);

        // Normalize score based on criteria direction
        let normalizedScore = this.normalizeScore(criteria.type, metricValue);

        // Apply weight
        const weightedScore = normalizedScore * criteria.weight;
        score.recordCriteriaScore(criteria.id, weightedScore);

        totalWeightedScore += weightedScore;
        totalWeight += criteria.weight;

        // Track by type
        if (!typeScores[criteria.type]) {
          typeScores[criteria.type] = [];
        }
        typeScores[criteria.type].push(normalizedScore);
      }

      // Calculate average scores by type
      for (const [type, scores] of Object.entries(typeScores)) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        score.breakdownByType[type] = Math.round(avg * 100) / 100;
      }

      // Calculate total score
      score.totalScore = totalWeightedScore;
      score.normalizedScore = Math.round((totalWeightedScore / totalWeight) * 100);

      score.markEvaluated = function() { this.status = 'evaluated'; return this; };
      this.scores.push(score);
      this.decision.scores.push(score);
    }
  }

  /**
   * Normalize score for a criteria type
   */
  normalizeScore(criteriaType, value) {
    let normalized = 0;

    switch (criteriaType) {
      case 'cost':
        // Lower cost is better (inverse)
        normalized = Math.max(0, 100 - (value / 10000)); // Scale down large numbers
        break;

      case 'revenue':
      case 'profitability':
      case 'resourceUtilization':
      case 'customerImpact':
      case 'strategicAlignment':
      case 'complianceScore':
        // Higher is better (direct)
        normalized = Math.min(100, value);
        break;

      case 'schedule':
        // Lower (faster) is better (inverse)
        normalized = Math.max(0, 100 - (value / 2)); // Scale down days
        break;

      case 'operational':
        // Lower risk is better (inverse)
        normalized = Math.max(0, 100 - value);
        break;

      default:
        normalized = value;
    }

    return Math.max(0, Math.min(100, normalized));
  }

  /**
   * Stage 5: Check Constraints
   */
  checkConstraints() {
    for (const score of this.scores) {
      const option = this.options_list.find(o => o.id === score.optionId);

      for (const constraint of this.context.constraints) {
        const metricValue = option.getMetricValue(constraint.criteria);
        const isSatisfied = constraint.isSatisfied(metricValue);

        score.recordConstraintStatus(constraint.id, isSatisfied);

        // If hard constraint violated, penalize
        if (!isSatisfied && constraint.type === 'hard') {
          if (constraint.violation === 'exclude') {
            option.markRejected();
          } else if (constraint.violation === 'penalize') {
            score.normalizedScore = Math.max(0, score.normalizedScore - 20);
          }
        }
      }
    }
  }

  /**
   * Stage 6: Rank Alternatives
   */
  rankAlternatives() {
    // Sort scores by normalized score (descending)
    const sortedScores = [...this.scores].sort((a, b) => 
      b.normalizedScore - a.normalizedScore
    );

    // Assign ranks and update decision
    for (let i = 0; i < sortedScores.length; i++) {
      sortedScores[i].rank = i + 1;
      this.decision.rankedOptions.push(sortedScores[i].optionId);
    }

    // Select best option (rank 1) - always select best score, even with violations
    const bestScore = sortedScores[0];
    if (bestScore) {
      const bestOption = this.options_list.find(o => o.id === bestScore.optionId);
      if (bestOption) {
        this.decision.markDecided(bestOption.id);
        bestOption.markSelected();
      }
    }
  }

  /**
   * Stage 7: Generate Explanation
   */
  generateExplanation() {
    const explanation = new DecisionExplanation({
      decisionId: this.decision.id,
      recommendedOptionId: this.decision.selectedOption?.id || ''
    });

    if (this.decision.selectedOption) {
      const option = this.decision.selectedOption;

      // Add summary
      explanation.summary = `Selected "${option.name}" based on weighted evaluation of ${this.context.criteria.length} key criteria.`;

      // Add rationale
      const topScore = this.scores.find(s => s.optionId === option.id);
      explanation.addRationale(`Highest weighted score: ${topScore.normalizedScore}/100`);
      
      for (const [type, score] of Object.entries(topScore.breakdownByType)) {
        explanation.addRationale(`${type}: ${score}/100`);
      }

      // Add strengths (metrics above 75)
      const metrics = option.getAllMetrics();
      for (const [key, value] of Object.entries(metrics)) {
        if (value > 75) {
          explanation.addStrength(`Strong ${key}: ${value}${this.getUnit(key)}`);
        }
      }

      // Add weaknesses (metrics below 50)
      for (const [key, value] of Object.entries(metrics)) {
        if (value < 50 && value > 0) {
          explanation.addWeakness(`Weak ${key}: ${value}${this.getUnit(key)}`);
        }
      }

      // Add tradeoffs
      if (this.options_list.length > 1) {
        const alternativeScores = this.scores
          .filter(s => s.optionId !== option.id)
          .sort((a, b) => b.normalizedScore - a.normalizedScore);

        if (alternativeScores.length > 0) {
          const alt = alternativeScores[0];
          const altOption = this.options_list.find(o => o.id === alt.optionId);
          const diff = option.cost < altOption.cost ? 'lower cost' : 'higher revenue';
          explanation.addTradeoff(
            `vs ${altOption.name}: This option prioritizes ${diff} and strategic alignment`
          );
        }
      }

      // Add risks from option
      if (option.risks && option.risks.length > 0) {
        explanation.riskFactors = option.risks;
      }

      // Add assumptions
      if (option.assumptions && option.assumptions.length > 0) {
        explanation.assumptions = option.assumptions;
      }

      // Calculate confidence based on margin over next option
      if (this.scores.length > 1) {
        const sorted = [...this.scores].sort((a, b) => b.normalizedScore - a.normalizedScore);
        const margin = sorted[0].normalizedScore - sorted[1].normalizedScore;
        explanation.confidence = Math.min(100, Math.round(75 + margin));
      } else {
        explanation.confidence = 85;
      }

      // Add next steps
      explanation.nextSteps = [
        'Review recommendation with stakeholders',
        'Approve implementation plan',
        'Allocate resources',
        'Execute phased rollout',
        'Monitor metrics and adjust'
      ];
    }

    this.decision.explanation = explanation;
  }

  /**
   * Get unit for a metric type
   */
  getUnit(type) {
    const units = {
      cost: ' USD',
      revenue: '%',
      profitability: '%',
      schedule: ' days',
      resourceUtilization: '%',
      customerImpact: ' points',
      operationalRisk: ' points',
      strategicAlignment: ' points',
      complianceScore: '%'
    };
    return units[type] || '';
  }

  /**
   * Stage 8: Create Recommendation
   */
  createRecommendation() {
    if (this.decision.selectedOption) {
      const option = this.decision.selectedOption;
      const score = this.scores.find(s => s.optionId === option.id);

      const recommendation = new DecisionRecommendation({
        decisionId: this.decision.id,
        recommendedOptionId: option.id,
        recommendedOption: option,
        priority: score.normalizedScore > 85 ? 'critical' : 'high',
        confidence: 80,
        expectedOutcome: `Implement ${option.name} approach`,
        implementation: `Execute ${option.description}`,
        timeline: `${option.schedule} days for full implementation`,
        dependencies: this.extractDependencies(option),
        successCriteria: this.generateSuccessCriteria(option)
      });

      recommendation.markApproved('decision-engine');
      this.decision.recommendation = recommendation;
    }
  }

  /**
   * Extract implementation dependencies
   */
  extractDependencies(option) {
    const deps = [];
    if (option.schedule > 120) {
      deps.push('Phased resource allocation');
    }
    if (option.cost > 350000) {
      deps.push('Budget approval');
    }
    if (option.operationalRisk > 60) {
      deps.push('Risk mitigation planning');
    }
    return deps;
  }

  /**
   * Generate success criteria
   */
  generateSuccessCriteria(option) {
    return [
      `Achieve ${option.revenue}% revenue impact`,
      `Complete within ${option.schedule} days`,
      `Maintain ${option.complianceScore}% compliance`,
      `Achieve ${option.customerImpact}% customer satisfaction`,
      `Maintain ${option.resourceUtilization}% resource efficiency`
    ];
  }

  /**
   * Persist Artifacts
   */
  async persistArtifacts() {
    const tenantId = this.context?.tenantId || 'default';
    const outputDir = path.join(__dirname, '../../..', 'out/generated/decisions', `tenant-${tenantId}`);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write decision blueprint
    fs.writeFileSync(
      path.join(outputDir, 'decision-blueprint.json'),
      JSON.stringify(this.decision.toJSON(), null, 2)
    );

    // Write decision context
    fs.writeFileSync(
      path.join(outputDir, 'decision-context.json'),
      JSON.stringify(this.context.toJSON(), null, 2)
    );

    // Write scores
    fs.writeFileSync(
      path.join(outputDir, 'decision-scores.json'),
      JSON.stringify(this.scores.map(s => s.toJSON()), null, 2)
    );

    // Write explanation
    if (this.decision.explanation) {
      fs.writeFileSync(
        path.join(outputDir, 'decision-explanation.json'),
        JSON.stringify(this.decision.explanation.toJSON(), null, 2)
      );
    }

    // Write recommendation
    if (this.decision.recommendation) {
      fs.writeFileSync(
        path.join(outputDir, 'decision-recommendation.json'),
        JSON.stringify(this.decision.recommendation.toJSON(), null, 2)
      );
    }

    // Write comprehensive decision
    fs.writeFileSync(
      path.join(outputDir, 'decision-full.json'),
      JSON.stringify({
        decision: this.decision.toJSON(),
        context: this.context.toJSON(),
        scores: this.scores.map(s => s.toJSON())
      }, null, 2)
    );
  }
}
