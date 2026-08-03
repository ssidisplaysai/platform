import { stableStringify } from "../../core/stableStringify";
import { SourceHash } from "../../provenance/SourceHash";
import { deepFreeze } from "../foundation/immutability";
import type {
	EntityAlias,
	EntityDuplicateLink,
	EntityIdentityObservation,
	EntityIdentityResolutionStatus,
	EntityRuntimeCheck,
	EntityRuntimeCheckStatus,
	EntityRuntimeCreateInput,
	EntityRuntimeCreateOptions,
	EntityRuntimeFactoryOptions,
	EntityRuntimeLifecycle,
	EntityRuntimeLifecycleState,
	EntityRuntimeOutcome,
	EntityRuntimeRecord,
	EntityRuntimeRule,
	EntityRuntimeRuleResult,
} from "./contracts";

function hashFromObject(value: unknown): string {
	return SourceHash.sha256(stableStringify(value));
}

function normalizeName(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/\s+/g, " ");
}

function normalizeUnique(values: readonly string[]): readonly string[] {
	return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))].sort();
}

function orderObservations(observations: readonly EntityIdentityObservation[]): readonly EntityIdentityObservation[] {
	return [...observations].sort((left, right) => {
		const leftKey = `${left.observationId}:${left.sourceEvidenceId}:${left.sourceValidationId}:${left.rawName}`;
		const rightKey = `${right.observationId}:${right.sourceEvidenceId}:${right.sourceValidationId}:${right.rawName}`;
		return leftKey.localeCompare(rightKey);
	});
}

function clampConfidence(value: number): number {
	if (Number.isNaN(value)) {
		return 0;
	}

	if (value < 0) {
		return 0;
	}

	if (value > 1) {
		return 1;
	}

	return Number(value.toFixed(6));
}

function tokenSet(value: string): readonly string[] {
	return [...new Set(normalizeName(value).split(" ").filter((token) => token.length > 0))].sort();
}

function jaccardSimilarity(left: readonly string[], right: readonly string[]): number {
	const leftSet = new Set(left);
	const rightSet = new Set(right);
	const intersection = [...leftSet].filter((token) => rightSet.has(token)).length;
	const union = new Set([...leftSet, ...rightSet]).size;
	if (union === 0) {
		return 0;
	}

	return Number((intersection / union).toFixed(6));
}

export class EntityRuntimeFactory {
	private readonly clock: () => string;

	private readonly configuration: EntityRuntimeFactoryOptions["configuration"];

	public constructor(options: EntityRuntimeFactoryOptions) {
		this.configuration = deepFreeze({ ...options.configuration });
		this.clock = options.clock ?? (() => new Date().toISOString());
	}

	public createEntityRecord(
		input: EntityRuntimeCreateInput,
		rules: readonly EntityRuntimeRule[],
		options: EntityRuntimeCreateOptions,
	): EntityRuntimeRecord {
		const createdAt = this.clock();
		const normalizedInput = this.normalizeInput(input);
		const observedAliases = this.buildObservedAliases(normalizedInput.observations);
		const aliases = this.buildAliases(observedAliases);
		const contradictions = this.buildContradictionObservationIds(normalizedInput.observations);
		const confidence = this.buildConfidence(normalizedInput.observations);
		const duplicateLinks = this.buildDuplicateLinks(observedAliases, aliases);
		const resolution = this.buildResolution(aliases, confidence, contradictions);
		const checks = deepFreeze([
			...this.evaluateLinkageChecks(normalizedInput, aliases, contradictions, createdAt),
			...this.evaluateChecks(normalizedInput, rules, createdAt),
		]);
		const outcome = this.deriveOutcome(checks);

		const candidateId = hashFromObject({
			runtimeId: this.configuration.runtimeId,
			entityClass: normalizedInput.entityClass,
			aliases: aliases.map((alias) => alias.normalizedAlias),
			resolutionStatus: resolution.identityStatus,
		});

		const canonicalName = aliases[0]?.alias ?? "UNRESOLVED";
		const normalizedCanonicalName = aliases[0]?.normalizedAlias ?? "unresolved";

		const entityDigest = hashFromObject({
			runtimeId: this.configuration.runtimeId,
			compilerVersion: this.configuration.compilerVersion,
			schemaVersion: this.configuration.schemaVersion,
			candidateId,
			entityClass: normalizedInput.entityClass,
			identityStatus: resolution.identityStatus,
			canonicalName: normalizedCanonicalName,
			aliases,
			duplicateLinks,
			contradictions,
			confidence,
			lineageFingerprint: normalizedInput.lineageFingerprint,
			outcome,
			checks: checks.map((check) => ({
				validatorName: check.validatorName,
				status: check.status,
				code: check.code,
				message: check.message,
			})),
		});

		const entityId = hashFromObject({
			runtimeId: this.configuration.runtimeId,
			candidateId,
			entityDigest,
			entityClass: normalizedInput.entityClass,
		});

		const previousVersionId = options.previousRecord?.version.versionId;
		const versionOrdinal = (options.previousRecord?.version.ordinal ?? 0) + 1;
		const version = {
			versionId: hashFromObject({
				entityId,
				versionOrdinal,
				reason: options.reason,
				previousVersionId,
				schemaVersion: this.configuration.schemaVersion,
			}),
			ordinal: versionOrdinal,
			previousVersionId,
			schemaVersion: this.configuration.schemaVersion,
			reason: options.reason,
			createdAt,
		};

		const lifecycleState = this.deriveLifecycleState(outcome, options.lifecycleTransition);
		const lifecycle: EntityRuntimeLifecycle = deepFreeze({
			currentState: lifecycleState,
			history: [
				{
					state: "DECLARED",
					at: createdAt,
					reason: "Entity record created",
				},
				{
					state: lifecycleState,
					at: createdAt,
					reason: options.reason,
				},
			],
		});

		const record: EntityRuntimeRecord = {
			entityId,
			entityDigest,
			candidateId,
			entityClass: normalizedInput.entityClass,
			identityStatus: resolution.identityStatus,
			canonicalName,
			normalizedCanonicalName,
			aliases,
			duplicateLinks,
			confidence,
			contradictionObservationIds: contradictions,
			unresolvedReason: resolution.unresolvedReason,
			outcome,
			checks,
			lifecycle,
			lineage: {
				sourceIbrId: normalizedInput.ibrRecord.ibrId,
				sourceIbrDigest: normalizedInput.ibrRecord.ibrDigest,
				sourceManifestId: normalizedInput.ibrRecord.manifestId,
				sourceReplayId: normalizedInput.ibrRecord.replayId,
				sourceValidationIds: normalizedInput.ibrRecord.trace.sourceValidationIds,
				sourceEvidenceIds: normalizedInput.ibrRecord.trace.sourceEvidenceIds,
				sourceCertificationIds: normalizedInput.ibrRecord.trace.sourceCertificationIds,
				deterministicFingerprint: normalizedInput.lineageFingerprint,
			},
			version,
			createdAt,
			updatedAt: createdAt,
		};

		return deepFreeze(record);
	}

	private normalizeInput(input: EntityRuntimeCreateInput): EntityRuntimeCreateInput & { readonly lineageFingerprint: string } {
		const observations = deepFreeze(orderObservations(input.observations));

		const lineageFingerprint = hashFromObject({
			ibrId: input.ibrRecord.ibrId,
			ibrDigest: input.ibrRecord.ibrDigest,
			sourceEvidenceIds: input.ibrRecord.trace.sourceEvidenceIds,
			sourceValidationIds: input.ibrRecord.trace.sourceValidationIds,
			sourceCertificationIds: input.ibrRecord.trace.sourceCertificationIds,
			observations: observations.map((observation) => ({
				observationId: observation.observationId,
				sourceEvidenceId: observation.sourceEvidenceId,
				sourceValidationId: observation.sourceValidationId,
				sourceCertificationId: observation.sourceCertificationId,
				rawName: observation.rawName,
				nameType: observation.nameType,
				confidence: clampConfidence(observation.confidence),
				stance: observation.stance,
				contradictsObservationIds: normalizeUnique(observation.contradictsObservationIds ?? []),
			})),
		});

		return {
			...input,
			observations,
			lineageFingerprint,
		};
	}

	private evaluateLinkageChecks(
		input: EntityRuntimeCreateInput & { readonly lineageFingerprint: string },
		aliases: readonly EntityAlias[],
		contradictions: readonly string[],
		checkedAt: string,
	): readonly EntityRuntimeCheck[] {
		const evidenceSet = new Set(input.ibrRecord.trace.sourceEvidenceIds);
		const validationSet = new Set(input.ibrRecord.trace.sourceValidationIds);
		const certificationSet = new Set(input.ibrRecord.trace.sourceCertificationIds);

		const checks: EntityRuntimeCheck[] = [
			{
				validatorName: "ibr-linkage",
				...this.createStatus(
					input.ibrRecord.outcome !== "BLOCKED" && input.ibrRecord.ibrId.length > 0,
					"IBR_LINKAGE",
					"entity runtime requires a non-blocked IBR runtime record",
					checkedAt,
				),
			},
			{
				validatorName: "observation-linkage",
				...this.createStatus(
					input.observations.length > 0 &&
						input.observations.every(
							(observation) =>
								evidenceSet.has(observation.sourceEvidenceId) &&
								validationSet.has(observation.sourceValidationId) &&
								certificationSet.has(observation.sourceCertificationId),
						),
					"OBSERVATION_LINKAGE",
					"entity observations must remain linked to IBR trace evidence, validation, and certification identifiers",
					checkedAt,
				),
			},
			{
				validatorName: "alias-presence",
				...this.createStatus(
					aliases.length > 0,
					"ALIAS_PRESENCE",
					"entity candidate requires at least one canonical alias to resolve identity",
					checkedAt,
					aliases.length === 0 ? "warn" : undefined,
				),
			},
			{
				validatorName: "lineage-fingerprint",
				...this.createStatus(
					input.lineageFingerprint.length === 64,
					"LINEAGE_FINGERPRINT",
					"lineage fingerprint must be deterministic sha-256",
					checkedAt,
				),
			},
			{
				validatorName: "contradiction-preservation",
				...this.createStatus(
					contradictions.every((id) => input.observations.some((observation) => observation.observationId === id)),
					"CONTRADICTION_PRESERVATION",
					"contradiction identifiers must map to known observations",
					checkedAt,
				),
			},
		];

		return deepFreeze(checks);
	}

	private createStatus(
		isPassing: boolean,
		code: string,
		message: string,
		checkedAt: string,
		overrideStatus?: EntityRuntimeCheckStatus,
	): EntityRuntimeRuleResult & { readonly checkedAt: string } {
		if (overrideStatus) {
			return {
				status: overrideStatus,
				code,
				message,
				checkedAt,
			};
		}

		return {
			status: isPassing ? "pass" : "fail",
			code,
			message,
			checkedAt,
		};
	}

	private evaluateChecks(
		input: EntityRuntimeCreateInput,
		rules: readonly EntityRuntimeRule[],
		checkedAt: string,
	): readonly EntityRuntimeCheck[] {
		const orderedRules = [...rules].sort((left, right) => left.name.localeCompare(right.name));

		const checks = orderedRules.map((rule) => {
			try {
				const result = rule.validate(input);
				return {
					validatorName: rule.name,
					status: result.status,
					code: result.code,
					message: result.message,
					checkedAt,
				} as EntityRuntimeCheck;
			} catch (error) {
				return {
					validatorName: rule.name,
					status: "fail",
					code: "VALIDATOR_EXCEPTION",
					message: error instanceof Error ? error.message : "Validator threw unknown error",
					checkedAt,
				} as EntityRuntimeCheck;
			}
		});

		return deepFreeze(checks);
	}

	private deriveOutcome(checks: readonly EntityRuntimeCheck[]): EntityRuntimeOutcome {
		const statusOrder: Record<EntityRuntimeCheckStatus, number> = {
			pass: 0,
			warn: 1,
			fail: 2,
		};

		const highest = checks.reduce<EntityRuntimeCheckStatus>(
			(current, check) => (statusOrder[check.status] > statusOrder[current] ? check.status : current),
			"pass",
		);

		if (highest === "fail") {
			return "BLOCKED";
		}

		if (highest === "warn") {
			return "WARN";
		}

		return "READY";
	}

	private deriveLifecycleState(
		outcome: EntityRuntimeOutcome,
		lifecycleTransition: EntityRuntimeCreateOptions["lifecycleTransition"],
	): EntityRuntimeLifecycleState {
		if (outcome === "BLOCKED") {
			return "BLOCKED";
		}

		if (lifecycleTransition === "SUPERSEDED") {
			return "SUPERSEDED";
		}

		if (lifecycleTransition === "RETIRED") {
			return "RETIRED";
		}

		return "ACTIVE";
	}

	private buildObservedAliases(observations: readonly EntityIdentityObservation[]): readonly (EntityAlias & {
		readonly observationId: string;
		readonly sourceEvidenceId: string;
		readonly sourceValidationId: string;
		readonly sourceCertificationId: string;
	})[] {
		const aliases = observations
			.filter((observation) => observation.stance !== "contradicting")
			.map((observation) => ({
				alias: observation.rawName.trim(),
				normalizedAlias: normalizeName(observation.rawName),
				nameType: observation.nameType,
				observationId: observation.observationId,
				sourceEvidenceId: observation.sourceEvidenceId,
				sourceValidationId: observation.sourceValidationId,
				sourceCertificationId: observation.sourceCertificationId,
			}))
			.filter((alias) => alias.alias.length > 0 && alias.normalizedAlias.length > 0)
			.sort((left, right) => {
				const leftKey = `${left.normalizedAlias}:${left.nameType}:${left.observationId}:${left.sourceEvidenceId}:${left.sourceValidationId}:${left.sourceCertificationId}`;
				const rightKey = `${right.normalizedAlias}:${right.nameType}:${right.observationId}:${right.sourceEvidenceId}:${right.sourceValidationId}:${right.sourceCertificationId}`;
				return leftKey.localeCompare(rightKey);
			});

		return deepFreeze(aliases);
	}

	private buildAliases(
		observedAliases: readonly (EntityAlias & {
			readonly observationId: string;
			readonly sourceEvidenceId: string;
			readonly sourceValidationId: string;
			readonly sourceCertificationId: string;
		})[],
	): readonly EntityAlias[] {
		const aliases = observedAliases;

		const deduped: EntityAlias[] = [];
		for (const alias of aliases) {
			if (!deduped.some((current) => current.normalizedAlias === alias.normalizedAlias)) {
				deduped.push(alias);
			}
		}

		return deepFreeze(deduped);
	}

	private buildDuplicateLinks(
		observedAliases: readonly (EntityAlias & {
			readonly observationId: string;
			readonly sourceEvidenceId: string;
			readonly sourceValidationId: string;
			readonly sourceCertificationId: string;
		})[],
		aliases: readonly EntityAlias[],
	): readonly EntityDuplicateLink[] {
		const links: EntityDuplicateLink[] = [];

		for (let index = 0; index < observedAliases.length; index += 1) {
			for (let compareIndex = index + 1; compareIndex < observedAliases.length; compareIndex += 1) {
				const left = observedAliases[index];
				const right = observedAliases[compareIndex];

				const duplicateScore = left.normalizedAlias === right.normalizedAlias ? 1 : 0;
				if (duplicateScore === 1) {
					links.push({
						candidateId: hashFromObject({
							normalizedAlias: left.normalizedAlias,
							leftObservationId: left.observationId,
							rightObservationId: right.observationId,
							leftEvidenceId: left.sourceEvidenceId,
							rightEvidenceId: right.sourceEvidenceId,
							leftValidationId: left.sourceValidationId,
							rightValidationId: right.sourceValidationId,
							leftCertificationId: left.sourceCertificationId,
							rightCertificationId: right.sourceCertificationId,
						}),
						matchType: "duplicate",
						score: 1,
					});
				}
			}
		}

		for (let index = 0; index < aliases.length; index += 1) {
			for (let compareIndex = index + 1; compareIndex < aliases.length; compareIndex += 1) {
				const left = aliases[index];
				const right = aliases[compareIndex];

				const nearScore = jaccardSimilarity(tokenSet(left.normalizedAlias), tokenSet(right.normalizedAlias));
				if (nearScore >= 0.5 && nearScore < 1) {
					links.push({
						candidateId: hashFromObject({ left: left.normalizedAlias, right: right.normalizedAlias }),
						matchType: "near-duplicate",
						score: nearScore,
					});
				}
			}
		}

		return deepFreeze(
			links.sort((left, right) => {
				const leftKey = `${left.matchType}:${left.score}:${left.candidateId}`;
				const rightKey = `${right.matchType}:${right.score}:${right.candidateId}`;
				return leftKey.localeCompare(rightKey);
			}),
		);
	}

	private buildContradictionObservationIds(observations: readonly EntityIdentityObservation[]): readonly string[] {
		const explicit = observations.flatMap((observation) => observation.contradictsObservationIds ?? []);
		const contradicting = observations
			.filter((observation) => observation.stance === "contradicting")
			.map((observation) => observation.observationId);

		return deepFreeze(normalizeUnique([...explicit, ...contradicting]));
	}

	private buildConfidence(observations: readonly EntityIdentityObservation[]) {
		const supporting = observations.filter((observation) => observation.stance === "supporting");
		const contradicting = observations.filter((observation) => observation.stance === "contradicting");
		const unknown = observations.filter((observation) => observation.stance === "unknown");

		const supportingScore = supporting.reduce((sum, observation) => sum + clampConfidence(observation.confidence), 0);
		const contradictingScore = contradicting.reduce((sum, observation) => sum + clampConfidence(observation.confidence), 0);
		const denominator = supporting.length + contradicting.length;
		const score = denominator === 0 ? 0 : (supportingScore - contradictingScore + denominator) / (2 * denominator);

		return deepFreeze({
			score: Number(score.toFixed(6)),
			supportingCount: supporting.length,
			contradictingCount: contradicting.length,
			unknownCount: unknown.length,
			reproducible: true as const,
		});
	}

	private buildResolution(
		aliases: readonly EntityAlias[],
		confidence: { readonly score: number; readonly supportingCount: number; readonly contradictingCount: number },
		contradictions: readonly string[],
	): { readonly identityStatus: EntityIdentityResolutionStatus; readonly unresolvedReason?: string } {
		if (aliases.length === 0) {
			return {
				identityStatus: "UNRESOLVED",
				unresolvedReason: "INSUFFICIENT_EVIDENCE",
			};
		}

		if (confidence.supportingCount === 0) {
			return {
				identityStatus: "UNRESOLVED",
				unresolvedReason: "INSUFFICIENT_SUPPORTING_OBSERVATIONS",
			};
		}

		if (confidence.contradictingCount > 0 && contradictions.length > 0 && confidence.score < 0.6) {
			return {
				identityStatus: "CONFLICTED",
				unresolvedReason: "CONTRADICTORY_OBSERVATIONS",
			};
		}

		return {
			identityStatus: "RESOLVED",
		};
	}
}
