import { getPrismaClient } from "./src/lib/glw/prisma";
const prisma = getPrismaClient();
const ids = [
  'glw_hy845ka8','glw_ctetrv7b','glw_pasnczw9','glw_1dg1hax8','glw_efqt1ei9','glw_owf3sibn','glw_djkdcuua','glw_zmi0y12i','glw_rgrxbtgz','glw_nsgibcwf','glw_3xhc9miq','glw_v3egowo1','glw_vcvmbaci',
  'glw_55vlefzi','glw_62oo3skz','glw_i3qjy7o4','glw_h0vcmsbv','glw_7w46zk8p','glw_a9ei5bp4','glw_k351vq29','glw_8xtxtluq','glw_50z2ocyc','glw_dvha865g','glw_z9degh6w','glw_wqsdcw6u'
];
const jobs = await prisma.glwJob.findMany({ where: { id: { in: ids } }, select: { id: true, status: true, error: true, externalExecutionId: true, startedAt: true, completedAt: true, updatedAt: true } });
console.log(JSON.stringify({ count: jobs.length, jobs }, null, 2));
await prisma.$disconnect();