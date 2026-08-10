import type {
  GenesisApplicationJobRecord,
  GenesisApplicationJobStatus,
  GenesisApplicationJobType,
  GenesisJob,
  GenesisJobEvent,
  GenesisJobStatus,
  GenesisJobType,
  GenesisModuleManifest,
} from "../contracts";
import { createGenesisJobSnapshot } from "../job-engine";

export function mapGlwJobTypeToGenesisJobType(jobType: GenesisApplicationJobType): GenesisJobType {
  return jobType;
}

export function mapGlwJobStatusToGenesisJobStatus(status: GenesisApplicationJobStatus): GenesisJobStatus {
  return status === "FAILED_QA" ? "FAILED" : status;
}

export function toGenesisJob(job: GenesisApplicationJobRecord): GenesisJob<GenesisJobType, GenesisApplicationJobRecord["input"], GenesisApplicationJobRecord["result"]> {
  return {
    jobId: job.id,
    type: mapGlwJobTypeToGenesisJobType(job.type),
    applicationId: "glw",
    moduleId: "glw.core",
    status: mapGlwJobStatusToGenesisJobStatus(job.status),
    priority: "NORMAL",
    input: job.input,
    result: job.result,
    error: job.error,
    events: [
      {
        eventId: `${job.id}_created`,
        jobId: job.id,
        moduleId: "glw.core",
        jobType: mapGlwJobTypeToGenesisJobType(job.type),
        type: "JOB_CREATED",
        label: "Job Created",
        stage: "request_intake",
        status: "QUEUED",
        message: "GLW job record created.",
        source: "glw.page-generation",
        occurredAt: job.createdAt,
        sequence: 1,
      } satisfies GenesisJobEvent,
    ],
    artifacts: [],
    notifications: [],
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    updatedAt: job.updatedAt,
  };
}

export function buildGlwGenesisModuleManifest(): GenesisModuleManifest {
  return {
    moduleId: "glw.core",
    name: "GLW",
    description: "Reference implementation for the Genesis Job Engine and Inspector.",
    enabled: true,
    order: 10,
    navigation: [
      { label: "Dashboard", href: "/glw", icon: "dashboard", order: 10, enabled: true },
      { label: "Projects", href: "/glw/projects", icon: "projects", order: 15, enabled: true },
      { label: "Agents", href: "/glw/agents", icon: "operations", order: 18, enabled: true },
      { label: "Tools", href: "/glw/tools", icon: "settings", order: 19, enabled: true },
      { label: "Memory", href: "/glw/memory", icon: "operations", order: 20, enabled: true },
      { label: "Orchestrations", href: "/glw/orchestrations", icon: "operations", order: 21, enabled: true },
      { label: "Executive", href: "/glw/executive", icon: "operations", order: 22, enabled: true },
      { label: "Operations Agent", href: "/glw/operations-agent", icon: "operations", order: 23, enabled: true },
      { label: "Manufacturing Agent", href: "/glw/manufacturing-agent", icon: "operations", order: 24, enabled: true },
      { label: "Marketing Agent", href: "/glw/marketing-agent", icon: "operations", order: 25, enabled: true },
      { label: "Sales Agent", href: "/glw/sales-agent", icon: "operations", order: 26, enabled: true },
      { label: "Finance Agent", href: "/glw/finance-agent", icon: "operations", order: 27, enabled: true },
      { label: "Customer Success Agent", href: "/glw/customer-success-agent", icon: "operations", order: 28, enabled: true },
      { label: "Pages", href: "/glw/pages", icon: "page", order: 28, enabled: true },
      { label: "Operations", href: "/glw/operations", icon: "operations", order: 30, enabled: true },
      { label: "Blogs", href: "/glw/blogs", icon: "blogs", order: 40, enabled: true },
      { label: "Queue", href: "/glw/queue", icon: "queue", order: 50, enabled: true },
      { label: "Sites", href: "/glw/sites", icon: "sites", order: 60, enabled: true },
      { label: "Settings", href: "/glw/settings", icon: "settings", order: 70, enabled: true },
    ],
    routes: [
      { label: "Dashboard", href: "/glw", description: "Operating overview" },
      { label: "Projects", href: "/glw/projects", description: "Project and site management" },
      { label: "Agents", href: "/glw/agents", description: "Enterprise agent framework workspace" },
      { label: "Tools", href: "/glw/tools", description: "Enterprise tool framework workspace" },
      { label: "Memory", href: "/glw/memory", description: "Enterprise memory and context framework workspace" },
      { label: "Orchestrations", href: "/glw/orchestrations", description: "Enterprise multi-agent orchestration workspace" },
      { label: "Executive", href: "/glw/executive", description: "Genesis Executive Agent workspace" },
      { label: "Operations Agent", href: "/glw/operations-agent", description: "Genesis Operations Agent workspace" },
      { label: "Manufacturing Agent", href: "/glw/manufacturing-agent", description: "Genesis Manufacturing Agent workspace" },
      { label: "Marketing Agent", href: "/glw/marketing-agent", description: "Genesis Marketing Agent workspace" },
      { label: "Sales Agent", href: "/glw/sales-agent", description: "Genesis Sales Agent workspace" },
      { label: "Finance Agent", href: "/glw/finance-agent", description: "Genesis Finance Agent workspace" },
      { label: "Customer Success Agent", href: "/glw/customer-success-agent", description: "Genesis Customer Success Agent workspace" },
      { label: "Pages", href: "/glw/pages", description: "Page generation jobs" },
      { label: "Operations", href: "/glw/operations", description: "Live operations command center" },
      { label: "Blogs", href: "/glw/blogs", description: "Blog generation workspace" },
      { label: "Queue", href: "/glw/queue", description: "Queue operations" },
      { label: "Sites", href: "/glw/sites", description: "Managed sites" },
      { label: "Settings", href: "/glw/settings", description: "Workspace settings" },
    ],
    permissions: [],
    supportedJobTypes: ["PAGE_GENERATION", "BLOG_GENERATION"],
    metadata: {
      referenceImplementation: true,
    },
  };
}

export function snapshotGlwJobAsGenesis(job: GenesisApplicationJobRecord) {
  const genesisJob = toGenesisJob(job);
  const snapshot = createGenesisJobSnapshot(genesisJob);

  return {
    genesisJob,
    snapshot,
  };
}
