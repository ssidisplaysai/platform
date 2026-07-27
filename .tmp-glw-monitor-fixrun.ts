import { createPrismaGlwJobRepository } from "./src/lib/glw/job-repository";

(async () => {
  const repo = createPrismaGlwJobRepository();
  const id = "glw_i3qjy7o4";
  const events:any[] = [];
  let job = await repo.findById(id);
  if (!job) throw new Error('Job not found');
  events.push({at:new Date().toISOString(),status:job.status,resultStatus:job.result?.status,updatedAt:job.updatedAt,completedAt:job.completedAt,error:job.error?.message ?? null});

  const deadline = Date.now() + 420000;
  while (Date.now() < deadline) {
    if (["COMPLETE","FAILED","CANCELLED"].includes(job.status)) break;
    await new Promise(r=>setTimeout(r,5000));
    const latest = await repo.findById(id);
    if (!latest) throw new Error('Job disappeared');
    const currErr = latest.error?.message ?? null;
    const prev = events[events.length - 1];
    if (!prev || prev.status !== latest.status || prev.resultStatus !== latest.result?.status || prev.updatedAt !== latest.updatedAt || prev.error !== currErr) {
      events.push({at:new Date().toISOString(),status:latest.status,resultStatus:latest.result?.status,updatedAt:latest.updatedAt,completedAt:latest.completedAt,error:currErr});
    }
    job = latest;
  }

  const final = await repo.findById(id);
  console.log(JSON.stringify({jobId:id,events,final},null,2));
})();