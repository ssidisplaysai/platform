import { getBgeRepository, type BgeRepository } from "./repository";
import {
  BgeApprovalService,
  BgeObjectService,
  BgeProposalService,
  BgeRelationshipService,
  BgeTimelineService,
} from "./services";
import { GedEnterpriseEvidenceService } from "@/lib/ged/enterprise-evidence-service";
import { createBgeKnowledgeAuthority, type BgeKnowledgeAuthority } from "@/lib/gmp/bge-knowledge-authority";
import { BgeEventAuthority } from "@/platform/gop/bge-event-authority";
import { createBgeMissionControlProjector, type BgeMissionControlProjector } from "@/platform/gop/bge-mission-control-projector";
import type { GenesisEventStore } from "@/platform/gop/event-store";

export const BGE_CANONICAL_DOMAIN_BOUNDARY = "src/lib/bge";

export type BgeRuntime = {
  repository: BgeRepository;
  knowledge: BgeKnowledgeAuthority;
  projector: BgeMissionControlProjector;
  events: BgeEventAuthority;
  evidence: GedEnterpriseEvidenceService;
  objects: BgeObjectService;
  proposals: BgeProposalService;
  approvals: BgeApprovalService;
  relationships: BgeRelationshipService;
  timeline: BgeTimelineService;
};

export function createBgeRuntime(input?: {
  repository?: BgeRepository;
  eventStore?: GenesisEventStore;
  knowledge?: BgeKnowledgeAuthority;
  projector?: BgeMissionControlProjector;
}): BgeRuntime {
  const repository = input?.repository ?? getBgeRepository();
  const knowledge = input?.knowledge ?? createBgeKnowledgeAuthority();
  const projector = input?.projector ?? createBgeMissionControlProjector();
  const events = new BgeEventAuthority(input?.eventStore, projector, knowledge);

  return {
    repository,
    knowledge,
    projector,
    events,
    evidence: new GedEnterpriseEvidenceService(repository, events, knowledge),
    objects: new BgeObjectService(repository),
    proposals: new BgeProposalService(repository, events),
    approvals: new BgeApprovalService(repository, events),
    relationships: new BgeRelationshipService(repository),
    timeline: new BgeTimelineService(events),
  };
}

let singleton: BgeRuntime | null = null;

export function setBgeRuntimeForTests(runtime: BgeRuntime | null): void {
  singleton = runtime;
}

export function getBgeRuntime(): BgeRuntime {
  if (!singleton) {
    singleton = createBgeRuntime();
  }

  return singleton;
}