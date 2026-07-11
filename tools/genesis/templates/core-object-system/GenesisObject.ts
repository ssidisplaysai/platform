import type { ObjectIdentity } from "./ObjectIdentity";
import type { ObjectMetadata } from "./ObjectMetadata";
import type { ObjectRelationship } from "./ObjectRelationship";
import type { ObjectLifecycle } from "./ObjectLifecycle";
import type { ObjectTimeline } from "./ObjectTimeline";
import type { ObjectPermission } from "./ObjectPermission";
import type { ObjectAudit } from "./ObjectAudit";
import type { ObjectAIContext } from "./ObjectAIContext";
import type { ObjectKnowledge } from "./ObjectKnowledge";
import type { ObjectAutomation } from "./ObjectAutomation";
import type { ObjectSearch } from "./ObjectSearch";
import type { ObjectAnalytics } from "./ObjectAnalytics";

export interface GenesisObject {
  identity: ObjectIdentity;
  metadata: ObjectMetadata;
  relationships: ObjectRelationship[];
  lifecycle: ObjectLifecycle;
  timeline: ObjectTimeline;
  permissions: ObjectPermission[];
  audit: ObjectAudit;
  aiContext: ObjectAIContext;
  knowledge: ObjectKnowledge;
  automation: ObjectAutomation;
  search: ObjectSearch;
  analytics: ObjectAnalytics;
}
