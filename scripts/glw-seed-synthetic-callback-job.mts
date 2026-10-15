import { glwPageExecutionRepository } from "../src/modules/glw/page-execution-repository";
import { createSyntheticGlwCallbackSeed } from "../src/modules/glw/synthetic-callback-seed";

type CliOptions = {
  ownerApprovalId: string;
  executionId: string;
  confirm: string;
};

const REQUIRED_CONFIRM = "SEED-SYNTHETIC-CALLBACK-JOB";

function readCliOptions(argv: readonly string[]): CliOptions {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];
    if (!entry.startsWith("--")) continue;
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) continue;
    args.set(entry, next);
    index += 1;
  }

  const ownerApprovalId = args.get("--owner-approval-id")?.trim() ?? "";
  const executionId = args.get("--execution-id")?.trim() ?? "";
  const confirm = args.get("--confirm")?.trim() ?? "";

  if (!ownerApprovalId || !executionId || !confirm) {
    throw new Error(
      "Usage: npx tsx scripts/glw-seed-synthetic-callback-job.mts --owner-approval-id OWNER_APPROVAL-... --execution-id synthetic-execution-... --confirm SEED-SYNTHETIC-CALLBACK-JOB",
    );
  }

  if (confirm !== REQUIRED_CONFIRM) {
    throw new Error(`--confirm must exactly equal ${REQUIRED_CONFIRM}`);
  }

  return { ownerApprovalId, executionId, confirm };
}

async function main() {
  const options = readCliOptions(process.argv.slice(2));
  const seeded = await createSyntheticGlwCallbackSeed({
    ownerApprovalId: options.ownerApprovalId,
    executionId: options.executionId,
    repository: glwPageExecutionRepository,
  });

  const readback = await glwPageExecutionRepository.getById(seeded.jobId);
  if (!readback) {
    throw new Error("Synthetic callback seed readback failed after create.");
  }

  console.log(JSON.stringify({
    ok: true,
    jobId: readback.jobId,
    organizationId: readback.organizationId,
    siteId: readback.siteId,
    executionId: readback.externalExecutionId,
    status: readback.status,
    disposition: readback.disposition,
    qaStatus: readback.qaStatus,
    retentionPolicy: (readback.qaChecks as { syntheticCallbackSeed?: { retentionPolicy?: string } } | null)?.syntheticCallbackSeed?.retentionPolicy ?? null,
  }, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "unknown synthetic seed failure";
  console.error(`GLW_SYNTHETIC_CALLBACK_SEED=FAIL reason=${message}`);
  process.exitCode = 1;
});
