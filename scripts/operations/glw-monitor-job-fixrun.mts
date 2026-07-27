import { createPrismaGlwJobRepository } from "../../src/lib/glw/job-repository";

async function main() {
  const repo = createPrismaGlwJobRepository();
  const id = process.argv[2] ?? "glw_i3qjy7o4";
  const timeoutMs = Number(process.argv[3] ?? 420000);
  const events: Array<{
    at: string;
    status: string;
    resultStatus: string | null | undefined;
    updatedAt: string;
    completedAt: string | null | undefined;
    error: string | null;
  }> = [];

  let job = await repo.findById(id);
  if (!job) throw new Error("Job not found");

  events.push({
    at: new Date().toISOString(),
    status: job.status,
    resultStatus: job.result?.status,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt,
    error: job.error?.message ?? null,
  });

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (["COMPLETE", "FAILED", "CANCELLED"].includes(job.status)) break;

    await new Promise((resolve) => setTimeout(resolve, 5000));
    const latest = await repo.findById(id);
    if (!latest) throw new Error("Job disappeared");

    const currErr = latest.error?.message ?? null;
    const prev = events[events.length - 1];
    if (!prev || prev.status !== latest.status || prev.resultStatus !== latest.result?.status || prev.updatedAt !== latest.updatedAt || prev.error !== currErr) {
      events.push({
        at: new Date().toISOString(),
        status: latest.status,
        resultStatus: latest.result?.status,
        updatedAt: latest.updatedAt,
        completedAt: latest.completedAt,
        error: currErr,
      });
    }
    job = latest;
  }

  const final = await repo.findById(id);
  console.log(JSON.stringify({ jobId: id, events, final }, null, 2));
}

void main();
