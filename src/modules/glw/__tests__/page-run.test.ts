import {
  GlwPageRunTransitionError,
  advanceGlwPageRun,
  createGlwPageRun,
  createInMemoryGlwPageRunRepository,
  type GlwPageRunIdentity,
} from "../page-run";

const identity: GlwPageRunIdentity = {
  targetId: "target-campaign-tx-arlington",
  campaignId: "campaign-texas",
  organizationId: "ssi",
  siteId: "site-ssi-projectorenclosure",
  productId: "prod-ssi-fan-cooled-projector-enclosures",
  stateCode: "TX",
  citySlug: "arlington",
  cityName: "Arlington",
  canonicalPath: "fan-cooled-projector-enclosures/texas/arlington",
};

const generatedDraft = {
  title: "Fan Cooled Projector Enclosures in Arlington",
  contentHtml: "<p>Generated content.</p>",
  slug: "fan-cooled-projector-enclosures/texas/arlington",
  excerpt: null,
  seoTitle: "Fan Cooled Projector Enclosures in Arlington | SSI",
  metaDescription: "Generated draft",
  focusKeyphrase: "fan cooled projector enclosures arlington",
};

describe("GLW authoritative PageRun lifecycle", () => {
  test("runs the one-way production lifecycle to WordPress draft", () => {
    let run = createGlwPageRun({ runId: "run-1", identity, now: "2030-01-01T00:00:00.000Z" });
    run = advanceGlwPageRun(run, {
      to: "DISPATCHED",
      generationJobId: "job-1",
      externalExecutionId: "700001",
    }, "2030-01-01T00:00:01.000Z");
    run = advanceGlwPageRun(run, {
      to: "RUNNING",
      generationJobId: "job-1",
      externalExecutionId: "700001",
    }, "2030-01-01T00:00:02.000Z");
    run = advanceGlwPageRun(run, {
      to: "GENERATED",
      generationJobId: "job-1",
      externalExecutionId: "700001",
      generatedDraft,
    }, "2030-01-01T00:00:03.000Z");
    run = advanceGlwPageRun(run, {
      to: "QA_PASSED",
      qaChecks: { content: "PASS", authority: "PASS" },
    }, "2030-01-01T00:00:04.000Z");
    run = advanceGlwPageRun(run, {
      to: "WORDPRESS_DRAFT",
      wordpressObjectId: "13150",
      wordpressUrl: "https://example.test/?page_id=13150",
    }, "2030-01-01T00:00:05.000Z");

    expect(run).toMatchObject({
      runId: "run-1",
      targetId: identity.targetId,
      status: "WORDPRESS_DRAFT",
      generationJobId: "job-1",
      externalExecutionId: "700001",
      wordpressObjectId: "13150",
      wordpressStatus: "draft",
    });
  });

  test("forbids skipping generated and QA states", () => {
    const run = createGlwPageRun({ runId: "run-1", identity });
    expect(() => advanceGlwPageRun(run, {
      to: "WORDPRESS_DRAFT",
      wordpressObjectId: "13150",
      wordpressUrl: null,
    })).toThrow(GlwPageRunTransitionError);
  });

  test("does not permit external execution identity to drift", () => {
    let run = createGlwPageRun({ runId: "run-1", identity });
    run = advanceGlwPageRun(run, {
      to: "DISPATCHED",
      generationJobId: "job-1",
      externalExecutionId: "700001",
    });

    expect(() => advanceGlwPageRun(run, {
      to: "GENERATED",
      generationJobId: "job-1",
      externalExecutionId: "700002",
      generatedDraft,
    })).toThrow("external execution identity cannot change");
  });

  test("keeps exactly one active run per target", async () => {
    const repository = createInMemoryGlwPageRunRepository();
    await repository.create(createGlwPageRun({ runId: "run-1", identity }));

    await expect(
      repository.create(createGlwPageRun({ runId: "run-2", identity })),
    ).rejects.toThrow("Target already has an active PageRun");
  });

  test("resolves the authoritative run by generation job identity", async () => {
    const repository = createInMemoryGlwPageRunRepository();
    let run = createGlwPageRun({ runId: "run-job-lookup", identity });
    run = advanceGlwPageRun(run, {
      to: "DISPATCHED",
      generationJobId: "job-lookup",
      externalExecutionId: "700099",
    });
    await repository.create(run);

    await expect(repository.getByGenerationJobId("job-lookup")).resolves.toMatchObject({
      runId: "run-job-lookup",
      targetId: identity.targetId,
      generationJobId: "job-lookup",
    });
    await expect(repository.getByGenerationJobId("missing-job")).resolves.toBeNull();
  });

  test("discard and regenerate atomically abandons the old run and points at one replacement", async () => {
    const repository = createInMemoryGlwPageRunRepository();
    await repository.create(createGlwPageRun({ runId: "run-1", identity }));
    await repository.transition("run-1", "CREATED", {
      to: "DISPATCHED",
      generationJobId: "job-1",
      externalExecutionId: "700001",
    });

    const replacement = await repository.abandonAndReplace({
      activeRunId: "run-1",
      replacementRunId: "run-2",
      reason: "Owner requested regeneration.",
    });

    expect(replacement).toMatchObject({
      runId: "run-2",
      targetId: identity.targetId,
      previousRunId: "run-1",
      status: "CREATED",
    });

    expect(await repository.getActiveByTarget(identity.targetId)).toMatchObject({
      runId: "run-2",
      status: "CREATED",
    });
    expect(await repository.getById("run-1")).toMatchObject({
      status: "ABANDONED",
      failure: {
        code: "ABANDONED",
        message: "Owner requested regeneration.",
      },
    });
  });

  test("discard and regenerate stops being legal after a WordPress draft exists", async () => {
    const repository = createInMemoryGlwPageRunRepository();
    let run = createGlwPageRun({ runId: "run-1", identity });
    run = advanceGlwPageRun(run, {
      to: "DISPATCHED",
      generationJobId: "job-1",
      externalExecutionId: "700001",
    });
    run = advanceGlwPageRun(run, {
      to: "GENERATED",
      generationJobId: "job-1",
      externalExecutionId: "700001",
      generatedDraft,
    });
    run = advanceGlwPageRun(run, {
      to: "QA_PASSED",
      qaChecks: { content: "PASS" },
    });
    run = advanceGlwPageRun(run, {
      to: "WORDPRESS_DRAFT",
      wordpressObjectId: "13150",
      wordpressUrl: null,
    });
    await repository.create(run);

    await expect(repository.abandonAndReplace({
      activeRunId: "run-1",
      replacementRunId: "run-2",
      reason: "Do not mutate a persisted draft.",
    })).rejects.toThrow("blocked after WordPress draft creation");
  });
});
