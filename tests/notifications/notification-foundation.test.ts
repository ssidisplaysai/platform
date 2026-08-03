import { describe, expect, it } from "@jest/globals";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  NotificationDefinition,
  NotificationRequest,
  SuppressionRule,
  TemplateDefinition,
} from "@/platform/notifications";
import {
  createFileNotificationPersistence,
  createInMemoryProviderRegistry,
  NotificationEngine,
  TemplateRenderer,
} from "@/platform/notifications";

function buildDefinition(overrides?: Partial<NotificationDefinition>): NotificationDefinition {
  const now = "2026-08-03T00:00:00.000Z";
  return {
    notificationId: "notification.build.completed",
    notificationType: "OPERATIONS",
    version: { major: 1, minor: 0, patch: 0 },
    state: "ACTIVE",
    name: "Build Completed",
    description: "Notifies operators when a build finishes.",
    allowedChannels: ["EMAIL", "IN_APP"],
    templateByChannel: {
      EMAIL: "template.build.completed.email",
      IN_APP: "template.build.completed.in_app",
    },
    defaultPriority: "NORMAL",
    retryPolicy: {
      maxAttempts: 2,
      retryDelaySeconds: 1,
      backoffMultiplier: 2,
      retryableReasons: ["simulated_failure"],
    },
    createdBy: "system",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function buildEmailTemplate(overrides?: Partial<TemplateDefinition>): TemplateDefinition {
  const now = "2026-08-03T00:00:00.000Z";
  return {
    templateId: "template.build.completed.email",
    channel: "EMAIL",
    version: { major: 1, minor: 0, patch: 0 },
    state: "ACTIVE",
    requiredVariables: ["jobName", "status"],
    subjectTemplate: "Build {{jobName}} is {{status}}",
    bodyTemplate: "Job {{jobName}} completed with status {{status}}.",
    createdBy: "system",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function buildInAppTemplate(overrides?: Partial<TemplateDefinition>): TemplateDefinition {
  const now = "2026-08-03T00:00:00.000Z";
  return {
    templateId: "template.build.completed.in_app",
    channel: "IN_APP",
    version: { major: 1, minor: 0, patch: 0 },
    state: "ACTIVE",
    requiredVariables: ["jobName", "status"],
    titleTemplate: "Build {{status}}",
    bodyTemplate: "{{jobName}}: {{status}}",
    createdBy: "system",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function buildRequest(overrides?: Partial<Omit<NotificationRequest, "requestId" | "requestedAt">>): Omit<NotificationRequest, "requestId" | "requestedAt"> {
  return {
    idempotencyKey: "idem-build-1",
    notificationId: "notification.build.completed",
    tenant: "tenant-1",
    workspace: "workspace-1",
    actorId: "operator@example.com",
    recipients: [
      {
        recipientId: "recipient-1",
        kind: "EXPLICIT",
        tenant: "tenant-1",
        workspace: "workspace-1",
        email: "alerts@example.com",
      },
    ],
    payload: {
      jobName: "release-1.4",
      status: "SUCCESS",
    },
    priority: "NORMAL",
    correlationId: "corr-1",
    causationId: "cause-1",
    ...overrides,
  };
}

async function createEngine(options?: {
  providerFailure?: boolean;
  persistenceOverride?: (persistence: ReturnType<typeof createFileNotificationPersistence>) => void | Promise<void>;
}) {
  const root = await mkdtemp(join(tmpdir(), "gnp-1001-"));
  const persistence = createFileNotificationPersistence({ rootDir: root });
  if (options?.persistenceOverride) {
    await options.persistenceOverride(persistence);
  }
  const providers = createInMemoryProviderRegistry({
    email: options?.providerFailure
      ? {
        shouldFail: () => true,
        retryable: false,
        failureReason: "simulated_failure",
      }
      : undefined,
  });

  return new NotificationEngine({
    persistence,
    providers,
  });
}

describe("GNP-1001 notification foundation", () => {
  it("delivers a queued notification request through configured channels", async () => {
    const engine = await createEngine();

    await engine.registerDefinition(buildDefinition());
    await engine.registerTemplate(buildEmailTemplate());
    await engine.registerTemplate(buildInAppTemplate());

    const queued = await engine.queueRequest(buildRequest());
    const processed = await engine.processRequest(queued.requestId);

    expect(processed.state).toBe("DELIVERED");
    expect(processed.deliveredCount).toBeGreaterThan(0);

    const metrics = await engine.getMetrics();
    expect(metrics.requestedNotifications).toBe(1);
    expect(metrics.deliveredNotifications).toBeGreaterThan(0);

    const audit = await engine.getAuditTrail(20);
    expect(audit.some((record) => record.eventType === "DELIVERY_SUCCEEDED")).toBe(true);
  });

  it("suppresses delivery when active suppression rule matches recipient/channel", async () => {
    const engine = await createEngine();

    await engine.registerDefinition(buildDefinition());
    await engine.registerTemplate(buildEmailTemplate());
    await engine.registerTemplate(buildInAppTemplate());

    const rule: SuppressionRule = {
      suppressionId: "suppress-1",
      scope: "CHANNEL",
      tenant: "tenant-1",
      channel: "EMAIL",
      reason: "maintenance_window",
      active: true,
    };
    await engine.upsertSuppressionRule(rule);

    const queued = await engine.queueRequest(buildRequest());
    const processed = await engine.processRequest(queued.requestId);

    expect(processed.suppressed).toBe(true);

    const audit = await engine.getAuditTrail(30);
    expect(audit.some((record) => record.eventType === "SUPPRESSED")).toBe(true);
  });

  it("sends exhausted non-retryable failures to dead letter", async () => {
    const engine = await createEngine({ providerFailure: true });

    await engine.registerDefinition(buildDefinition());
    await engine.registerTemplate(buildEmailTemplate());
    await engine.registerTemplate(buildInAppTemplate({
      channel: "EMAIL",
      templateId: "template.build.completed.in_app",
    }));

    const queued = await engine.queueRequest(buildRequest({
      recipients: [
        {
          recipientId: "recipient-1",
          kind: "EXPLICIT",
          tenant: "tenant-1",
          workspace: "workspace-1",
          email: "alerts@example.com",
        },
      ],
    }));

    const processed = await engine.processRequest(queued.requestId);

    expect(processed.failedCount).toBeGreaterThan(0);

    const deadLetters = await engine.listDeadLetters();
    expect(deadLetters.length).toBeGreaterThan(0);

    const metrics = await engine.getMetrics();
    expect(metrics.deadLetteredNotifications).toBeGreaterThan(0);
  });

  it("renders the same output for identical template inputs", () => {
    const renderer = new TemplateRenderer();
    const template = buildEmailTemplate({ locale: "en-US" });
    const payload = {
      jobName: "release-1.4",
      status: "SUCCESS",
    };

    const first = renderer.render({ template, payload });
    const second = renderer.render({ template, payload });

    expect(first).toEqual(second);
    expect(first.renderIdentity).toBe(second.renderIdentity);
    expect(first.variables).not.toHaveProperty("renderId");
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("completes notification delivery when audit persistence fails transiently", async () => {
    let attempts = 0;
    const engine = await createEngine({
      persistenceOverride: async (persistence) => {
        const originalAppend = persistence.audits.append.bind(persistence.audits);
        persistence.audits.append = async (record) => {
          attempts += 1;
          if (attempts === 1) {
            const error = new Error("audit_store_unavailable") as Error & { retryable?: boolean };
            error.retryable = true;
            throw error;
          }
          await originalAppend(record);
        };
      },
    });

    await engine.registerDefinition(buildDefinition());
    await engine.registerTemplate(buildEmailTemplate());
    await engine.registerTemplate(buildInAppTemplate());

    const queued = await engine.queueRequest(buildRequest());
    const processed = await engine.processRequest(queued.requestId);

    expect(processed.state).toBe("DELIVERED");

    const metrics = await engine.getMetrics();
    expect(metrics.auditFailures).toBeGreaterThan(0);
    expect(metrics.auditRetries).toBeGreaterThan(0);
    expect(processed.auditTerminalFailure).toBe(false);
  }, 15000);

  it("marks terminal audit failures without blocking notification completion", async () => {
    const engine = await createEngine({
      persistenceOverride: (persistence) => {
        persistence.audits.append = async () => {
          const error = new Error("audit_store_unavailable") as Error & { retryable?: boolean };
          error.retryable = false;
          throw error;
        };
        persistence.audits.appendMany = async () => {
          const error = new Error("audit_store_unavailable") as Error & { retryable?: boolean };
          error.retryable = false;
          throw error;
        };
      },
    });

    await engine.registerDefinition(buildDefinition());
    await engine.registerTemplate(buildEmailTemplate());
    await engine.registerTemplate(buildInAppTemplate());

    const queued = await engine.queueRequest(buildRequest());
    const processed = await engine.processRequest(queued.requestId);

    expect(processed.state).toBe("DELIVERED");
    expect(processed.auditFailures).toBeGreaterThan(0);
    expect(processed.auditTerminalFailure).toBe(true);

    const health = await engine.healthSnapshot();
    expect(health.status).toBe("DEGRADED");
    expect(health.checks.some((check) => check.name === "audit")).toBe(true);
  }, 15000);
});
